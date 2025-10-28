import { NextResponse } from 'next/server';
import db from '@/lib/database';

/**
 * バックアップから選択したテストを復元するAPI
 * POST /api/backup/restore-test
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { test } = body;

    if (!test) {
      return NextResponse.json(
        { error: 'テストデータが指定されていません' },
        { status: 400 }
      );
    }

    // 同じIDのテストが既に存在するかチェック
    const existingTest = db.prepare('SELECT id FROM tests WHERE id = ?').get(test.id);
    
    if (existingTest) {
      return NextResponse.json(
        { error: 'このテストは既に存在します' },
        { status: 400 }
      );
    }

    // テストを復元
    const insertTest = db.prepare(`
      INSERT INTO tests (id, name, subject, grade, folder_id, pdf_path, description, total_questions, total_score, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertTest.run(
      test.id,
      test.name,
      test.subject,
      test.grade,
      test.folder_id,
      test.pdf_path,
      test.description,
      test.total_questions,
      test.total_score,
      test.created_at,
      test.updated_at
    );

    // フォルダの関連付けを復元
    if (test.folders && test.folders.length > 0) {
      const insertTestFolder = db.prepare(
        "INSERT OR IGNORE INTO test_folders (test_id, folder_id) VALUES (?, ?)"
      );
      for (const folder of test.folders) {
        // フォルダが現在のDBに存在するか確認
        const folderExists = db.prepare('SELECT id FROM folders WHERE id = ?').get(folder.id);
        if (folderExists) {
          insertTestFolder.run(test.id, folder.id);
        }
      }
    }

    // タグの関連付けを復元
    if (test.tags && test.tags.length > 0) {
      const insertTestTag = db.prepare(
        "INSERT OR IGNORE INTO test_tags (test_id, tag_id) VALUES (?, ?)"
      );
      for (const tag of test.tags) {
        // タグが現在のDBに存在するか確認
        const tagExists = db.prepare('SELECT id FROM tags WHERE id = ?').get(tag.id);
        if (tagExists) {
          insertTestTag.run(test.id, tag.id);
        } else {
          // タグが存在しない場合は作成
          const insertTag = db.prepare(
            "INSERT INTO tags (id, name, color) VALUES (?, ?, ?)"
          );
          insertTag.run(tag.id, tag.name, tag.color);
          insertTestTag.run(test.id, tag.id);
        }
      }
    }

    return NextResponse.json({
      message: 'テストを復元しました',
      testId: test.id
    });

  } catch (error: any) {
    console.error('Test restore error:', error);
    return NextResponse.json(
      { error: 'テストの復元に失敗しました: ' + error.message },
      { status: 500 }
    );
  }
}
