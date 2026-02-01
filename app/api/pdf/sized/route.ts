import { NextRequest, NextResponse } from 'next/server';
import { convertPdfSize, PaperSize, PAPER_SIZES } from '@/lib/pdfConverter';
import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'public', 'pdf-cache');

/**
 * PDFサイズ変換API
 * GET /api/pdf/sized?testId=123&size=A3&pdfPath=/uploads/pdfs/test.pdf
 * GET /api/pdf/sized?testId=123&size=A3&pdfPath=/uploads/attachments/test.pdf&attachment=true&tabIndex=1
 * 
 * オリジナルPDFを指定サイズに変換してキャッシュ、またはキャッシュから返す
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const testId = searchParams.get('testId');
    const size = searchParams.get('size') as PaperSize;
    const pdfPath = searchParams.get('pdfPath');
    const isAttachment = searchParams.get('attachment') === 'true';
    const tabIndex = searchParams.get('tabIndex');
    
    // バリデーション
    if (!testId || !size || !pdfPath) {
      return NextResponse.json(
        { error: 'testId, size, pdfPath are required' },
        { status: 400 }
      );
    }
    
    if (!Object.keys(PAPER_SIZES).includes(size)) {
      return NextResponse.json(
        { error: `Invalid size. Must be one of: ${Object.keys(PAPER_SIZES).join(', ')}` },
        { status: 400 }
      );
    }
    
    // 元PDFのパス
    const originalPath = path.join(process.cwd(), 'public', pdfPath);
    
    if (!fs.existsSync(originalPath)) {
      return NextResponse.json(
        { error: 'Original PDF not found' },
        { status: 404 }
      );
    }
    
    // キャッシュパス（添付ファイルの場合はタブインデックスを含める）
    const cacheDir = path.join(CACHE_DIR, testId);
    const cacheFileName = isAttachment && tabIndex 
      ? `attachment_${tabIndex}_${size}.pdf` 
      : `${size}.pdf`;
    const cachePath = path.join(cacheDir, cacheFileName);
    
    // キャッシュが存在する場合
    if (fs.existsSync(cachePath)) {
      // アクセス時刻を更新（キャッシュの延命）
      const now = new Date();
      fs.utimesSync(cachePath, now, now);
      
      console.log(`[PDF API] Cache hit: ${testId}/${cacheFileName}`);
      
      // キャッシュファイルを返す
      const pdfBuffer = fs.readFileSync(cachePath);
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${cacheFileName}"`,
        },
      });
    }
    
    // キャッシュが存在しない場合は生成
    console.log(`[PDF API] Generating ${size} version for test ${testId}${isAttachment ? ` (attachment tab ${tabIndex})` : ''}...`);
    
    try {
      await convertPdfSize(originalPath, cachePath, size);
      
      // 生成したPDFを返す
      const pdfBuffer = fs.readFileSync(cachePath);
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${cacheFileName}"`,
        },
      });
    } catch (error) {
      console.error('[PDF API] Conversion error:', error);
      return NextResponse.json(
        { error: 'Failed to convert PDF' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('[PDF API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

