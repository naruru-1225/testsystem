import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

/**
 * PDFファイルアップロードAPI
 * POST /api/upload
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'ファイルが選択されていません' },
        { status: 400 }
      );
    }

    // PDFファイルかチェック
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'PDFファイルのみアップロード可能です' },
        { status: 400 }
      );
    }

    // ファイルサイズチェック(10MB制限)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'ファイルサイズは10MB以下にしてください' },
        { status: 400 }
      );
    }

    // アップロードディレクトリの作成
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'pdfs');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // ファイル名の生成(タイムスタンプ + ランダム文字列)
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const fileName = `${timestamp}-${randomStr}.pdf`;
    const filePath = path.join(uploadDir, fileName);

    // ファイルの保存
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // 公開パスを返す
    const publicPath = `/uploads/pdfs/${fileName}`;

    return NextResponse.json({
      success: true,
      path: publicPath,
      fileName,
      size: file.size,
    });
  } catch (error) {
    console.error('ファイルアップロードエラー:', error);
    return NextResponse.json(
      { error: 'ファイルのアップロードに失敗しました' },
      { status: 500 }
    );
  }
}
