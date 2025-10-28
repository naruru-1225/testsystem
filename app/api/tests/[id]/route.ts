import { NextResponse } from 'next/server';
import db from '@/lib/database';

/**
 * テスト個別取得API
 * GET /api/tests/[id]
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const testId = parseInt(id);

    if (isNaN(testId)) {
      return NextResponse.json(
        { error: '無効なテストIDです' },
        { status: 400 }
      );
    }

    // テスト情報の取得
    const test = db.prepare(`
      SELECT 
        t.*,
        f.name as folder_name
      FROM tests t
      LEFT JOIN folders f ON t.folder_id = f.id
      WHERE t.id = ?
    `).get(testId) as any;

    if (!test) {
      return NextResponse.json(
        { error: 'テストが見つかりません' },
        { status: 404 }
      );
    }

    // タグの取得
    const tags = db.prepare(`
      SELECT tg.*
      FROM tags tg
      INNER JOIN test_tags tt ON tg.id = tt.tag_id
      WHERE tt.test_id = ?
    `).all(testId);

    return NextResponse.json({
      ...test,
      tags,
    });
  } catch (error) {
    console.error('テスト取得エラー:', error);
    return NextResponse.json(
      { error: 'テストの取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * テスト更新API
 * PUT /api/tests/[id]
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const testId = parseInt(id);

    if (isNaN(testId)) {
      return NextResponse.json(
        { error: '無効なテストIDです' },
        { status: 400 }
      );
    }

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
        { error: '必須項目が入力されていません' },
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

    // テストの存在確認
    const existingTest = db.prepare('SELECT id FROM tests WHERE id = ?').get(testId);
    if (!existingTest) {
      return NextResponse.json(
        { error: 'テストが見つかりません' },
        { status: 404 }
      );
    }

    // テスト情報の更新
    db.prepare(`
      UPDATE tests 
      SET name = ?, subject = ?, grade = ?, folder_id = ?, pdf_path = ?, description = ?, total_questions = ?, total_score = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, subject, grade, folderIds[0], pdfPath, description, totalQuestions, totalScore, testId);

    // 既存のフォルダ関連を削除
    db.prepare('DELETE FROM test_folders WHERE test_id = ?').run(testId);

    // 新しいフォルダ関連を追加
    if (folderIds.length > 0) {
      const insertTestFolder = db.prepare('INSERT INTO test_folders (test_id, folder_id) VALUES (?, ?)');
      for (const folderId of folderIds) {
        insertTestFolder.run(testId, folderId);
      }
    }

    // 既存のタグ関連を削除
    db.prepare('DELETE FROM test_tags WHERE test_id = ?').run(testId);

    // 新しいタグ関連を追加
    if (tagIds.length > 0) {
      const insertTestTag = db.prepare('INSERT INTO test_tags (test_id, tag_id) VALUES (?, ?)');
      for (const tagId of tagIds) {
        insertTestTag.run(testId, tagId);
      }
    }

    // 更新後のテストを取得
    const updatedTest = db.prepare(`
      SELECT 
        t.*,
        f.name as folder_name
      FROM tests t
      LEFT JOIN folders f ON t.folder_id = f.id
      WHERE t.id = ?
    `).get(testId) as any;

    const tags = db.prepare(`
      SELECT tg.*
      FROM tags tg
      INNER JOIN test_tags tt ON tg.id = tt.tag_id
      WHERE tt.test_id = ?
    `).all(testId);

    const folders = db.prepare(`
      SELECT f.*
      FROM folders f
      INNER JOIN test_folders tf ON f.id = tf.folder_id
      WHERE tf.test_id = ?
    `).all(testId);

    return NextResponse.json({
      ...updatedTest,
      tags,
      folders,
    });
  } catch (error) {
    console.error('テスト更新エラー:', error);
    return NextResponse.json(
      { error: 'テストの更新に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * テスト削除API
 * DELETE /api/tests/[id]
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const testId = parseInt(id);

    if (isNaN(testId)) {
      return NextResponse.json(
        { error: '無効なテストIDです' },
        { status: 400 }
      );
    }

    // テストの存在確認
    const existingTest = db.prepare('SELECT id, name FROM tests WHERE id = ?').get(testId);
    if (!existingTest) {
      return NextResponse.json(
        { error: 'テストが見つかりません' },
        { status: 404 }
      );
    }

    // テストの削除(カスケード削除により test_tags も自動削除)
    db.prepare('DELETE FROM tests WHERE id = ?').run(testId);

    return NextResponse.json({
      message: 'テストを削除しました',
      deletedTest: existingTest,
    });
  } catch (error) {
    console.error('テスト削除エラー:', error);
    return NextResponse.json(
      { error: 'テストの削除に失敗しました' },
      { status: 500 }
    );
  }
}
