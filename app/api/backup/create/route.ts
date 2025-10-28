import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * バックアップ作成API
 * GET /api/backup/create
 */
export async function GET() {
  try {
    // データベースファイルのパス
    const dbPath = path.join(process.cwd(), 'data', 'tests.db');

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json(
        { error: 'データベースファイルが見つかりません' },
        { status: 404 }
      );
    }

    // データベースファイルを読み込む
    const dbBuffer = fs.readFileSync(dbPath);

    // ファイル名にタイムスタンプを含める
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `backup-${timestamp}.db`;

    // レスポンスヘッダーを設定してファイルをダウンロードさせる
    return new NextResponse(dbBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': dbBuffer.length.toString(),
      },
    });

  } catch (error: any) {
    console.error('Backup creation error:', error);
    return NextResponse.json(
      { error: 'バックアップの作成に失敗しました: ' + error.message },
      { status: 500 }
    );
  }
}
