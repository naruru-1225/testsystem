import { NextResponse } from "next/server";
import db from "@/lib/database";
import type { Test, Tag, Folder, TestWithTags } from "@/types/database";

/**
 * 指定されたフォルダの子孫フォルダIDを全て取得する(再帰的)
 */
function getDescendantFolderIds(folderId: number): number[] {
  const descendants: number[] = [];
  const children = db
    .prepare("SELECT id FROM folders WHERE parent_id = ?")
    .all(folderId) as { id: number }[];

  for (const child of children) {
    descendants.push(child.id);
    // 再帰的に孫フォルダも取得
    descendants.push(...getDescendantFolderIds(child.id));
  }

  return descendants;
}

/**
 * テスト一覧取得API
 * GET /api/tests
 * クエリパラメータ:
 *   - folderId: フォルダIDでフィルタ(子孫フォルダも含む)
 *   - grade: 学年でフィルタ
 *   - subject: 科目でフィルタ
 *   - search: テスト名、科目、学年での検索
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");
    const grade = searchParams.get("grade");
    const subject = searchParams.get("subject");
    const search = searchParams.get("search");

    let query = `
      SELECT 
        t.*,
        f.name as folder_name
      FROM tests t
      LEFT JOIN folders f ON t.folder_id = f.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // フォルダでフィルタ
    if (folderId) {
      // 選択されたフォルダとその子孫フォルダのIDを取得
      const descendantIds = getDescendantFolderIds(parseInt(folderId));
      descendantIds.push(parseInt(folderId)); // 自分自身も含める
      
      if (descendantIds.length === 1) {
        query += " AND t.folder_id = ?";
        params.push(folderId);
      } else {
        const placeholders = descendantIds.map(() => '?').join(',');
        query += ` AND t.folder_id IN (${placeholders})`;
        params.push(...descendantIds);
      }
    }

    // 学年でフィルタ
    if (grade) {
      query += " AND t.grade = ?";
      params.push(grade);
    }

    // 科目でフィルタ
    if (subject) {
      query += " AND t.subject = ?";
      params.push(subject);
    }

    // 検索条件
    if (search) {
      query += " AND (t.name LIKE ? OR t.subject LIKE ? OR t.grade LIKE ? OR t.description LIKE ?)";
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += " ORDER BY t.created_at DESC";

    const stmt = db.prepare(query);
    const tests = stmt.all(...params) as (Test & { folder_name: string })[];

    // 各テストに紐づくタグとフォルダを取得
    const testsWithTags: TestWithTags[] = tests.map((test) => {
      const tagStmt = db.prepare(`
        SELECT tg.*
        FROM tags tg
        INNER JOIN test_tags tt ON tg.id = tt.tag_id
        WHERE tt.test_id = ?
      `);
      const tags = tagStmt.all(test.id) as Tag[];

      const folderStmt = db.prepare(`
        SELECT f.*
        FROM folders f
        INNER JOIN test_folders tf ON f.id = tf.folder_id
        WHERE tf.test_id = ?
      `);
      const folders = folderStmt.all(test.id) as Folder[];

      return {
        ...test,
        tags,
        folders,
      };
    });

    return NextResponse.json(testsWithTags);
  } catch (error) {
    console.error("テスト一覧取得エラー:", error);
    return NextResponse.json(
      { error: "テスト一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * テスト新規作成API
 * POST /api/tests
 * リクエストボディ:
 *   - name: テスト名
 *   - subject: 科目
 *   - grade: 学年
 *   - folderId: フォルダID
 *   - tagIds: タグIDの配列
 *   - pdfPath: PDFファイルパス(任意)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { 
      name, 
      subject, 
      grade, 
      folderIds = [], // 配列として受け取る
      tagIds = [], 
      pdfPath = null,
      description = null,
      totalQuestions = null,
      totalScore = null
    } = body;

    // バリデーション
    if (!name || !subject || !grade) {
      return NextResponse.json(
        { error: "必須項目が入力されていません" },
        { status: 400 }
      );
    }

    // フォルダが空の場合は「未分類」フォルダを取得
    if (folderIds.length === 0) {
      const uncategorizedFolder = db
        .prepare("SELECT id FROM folders WHERE name = '未分類'")
        .get() as { id: number } | undefined;
      
      if (uncategorizedFolder) {
        folderIds = [uncategorizedFolder.id];
        console.log('Auto-assigned to 未分類 folder:', uncategorizedFolder.id);
      }
    }

    // トランザクション開始
    const insertTest = db.prepare(`
      INSERT INTO tests (name, subject, grade, folder_id, pdf_path, description, total_questions, total_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertTest.run(
      name, 
      subject, 
      grade, 
      folderIds[0], // 後方互換のため最初のフォルダIDを保存
      pdfPath, 
      description,
      totalQuestions,
      totalScore
    );
    const testId = result.lastInsertRowid;

    // フォルダの関連付け
    if (folderIds.length > 0) {
      const insertTestFolder = db.prepare(
        "INSERT INTO test_folders (test_id, folder_id) VALUES (?, ?)"
      );
      for (const folderId of folderIds) {
        insertTestFolder.run(testId, folderId);
      }
    }

    // タグの関連付け
    if (tagIds.length > 0) {
      const insertTestTag = db.prepare(
        "INSERT INTO test_tags (test_id, tag_id) VALUES (?, ?)"
      );
      for (const tagId of tagIds) {
        insertTestTag.run(testId, tagId);
      }
    }

    // 作成したテストを取得
    const newTest = db
      .prepare(
        `
      SELECT 
        t.*,
        f.name as folder_name
      FROM tests t
      LEFT JOIN folders f ON t.folder_id = f.id
      WHERE t.id = ?
    `
      )
      .get(testId) as Test & { folder_name: string };

    const tagStmt = db.prepare(`
      SELECT tg.*
      FROM tags tg
      INNER JOIN test_tags tt ON tg.id = tt.tag_id
      WHERE tt.test_id = ?
    `);
    const tags = tagStmt.all(testId) as Tag[];

    return NextResponse.json(
      {
        ...newTest,
        tags,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("テスト作成エラー:", error);
    return NextResponse.json(
      { error: "テストの作成に失敗しました" },
      { status: 500 }
    );
  }
}
