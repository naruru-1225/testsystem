import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import db from '@/lib/database';
import fs from 'fs';
import path from 'path';

/**
 * バックアップからテストリストを取得するAPI
 * POST /api/backup/restore
 */
export async function POST(request: Request) {
  let backupDb: Database.Database | null = null;
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'ファイルが選択されていません' },
        { status: 400 }
      );
    }

    // ファイルの拡張子チェック
    if (!file.name.endsWith('.db')) {
      return NextResponse.json(
        { error: 'データベースファイル(.db)を選択してください' },
        { status: 400 }
      );
    }

    // ファイルを一時的に保存
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempDbPath = path.join(tempDir, `restore-temp-${Date.now()}.db`);
    fs.writeFileSync(tempDbPath, buffer);

    // バックアップDBを読み取り専用で開く
    backupDb = new Database(tempDbPath, { readonly: true });

    // バックアップからテスト情報を取得
    const tests = backupDb.prepare(`
      SELECT 
        t.*,
        f.name as folder_name
      FROM tests t
      LEFT JOIN folders f ON t.folder_id = f.id
      ORDER BY t.created_at DESC
    `).all();

    // 各テストのタグ情報を取得
    const testsWithDetails = tests.map((test: any) => {
      const tags = backupDb!.prepare(`
        SELECT tg.*
        FROM tags tg
        INNER JOIN test_tags tt ON tg.id = tt.tag_id
        WHERE tt.test_id = ?
      `).all(test.id);

      const folders = backupDb!.prepare(`
        SELECT f.*
        FROM folders f
        INNER JOIN test_folders tf ON f.id = tf.folder_id
        WHERE tf.test_id = ?
      `).all(test.id);

      return {
        ...test,
        tags,
        folders
      };
    });

    // 一時ファイルを削除
    backupDb.close();
    fs.unlinkSync(tempDbPath);

    return NextResponse.json({
      tests: testsWithDetails,
      count: testsWithDetails.length
    });

  } catch (error: any) {
    console.error('Backup read error:', error);
    
    // クリーンアップ
    if (backupDb) {
      try {
        backupDb.close();
      } catch (e) {
        console.error('Error closing backup db:', e);
      }
    }
    
    return NextResponse.json(
      { error: 'バックアップファイルの読み込みに失敗しました: ' + error.message },
      { status: 500 }
    );
  }
}
