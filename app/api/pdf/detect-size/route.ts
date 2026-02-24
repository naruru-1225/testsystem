import { NextRequest, NextResponse } from 'next/server';
import { detectPdfSize, PAPER_SIZES } from '@/lib/pdfConverter';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

/**
 * PDF用紙サイズ検出API
 * GET /api/pdf/detect-size?pdfPath=/uploads/pdfs/test.pdf
 * 
 * PDFの最初のページからサイズと向きを検出して返す
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pdfPath = searchParams.get('pdfPath');
    
    if (!pdfPath) {
      return NextResponse.json(
        { error: 'pdfPath is required' },
        { status: 400 }
      );
    }
    
    // PDFファイルのパスを構築
    const fullPath = path.join(process.cwd(), 'public', pdfPath);
    
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json(
        { error: 'PDF not found' },
        { status: 404 }
      );
    }

    // ファイルがPDFかチェック
    const ext = path.extname(fullPath).toLowerCase();
    if (ext !== '.pdf') {
      return NextResponse.json({
        detectedSize: null,
        displayName: '画像ファイル',
        width: null,
        height: null,
        orientation: null,
      });
    }
    
    // サイズ名を検出
    const detectedSize = await detectPdfSize(fullPath);
    
    // ページの実際のサイズも取得
    const pdfBytes = fs.readFileSync(fullPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const firstPage = pdfDoc.getPages()[0];
    const { width, height } = firstPage.getSize();
    const orientation = width > height ? 'landscape' : 'portrait';
    
    // 表示名を構築
    let displayName: string;
    if (detectedSize === 'CUSTOM') {
      // カスタムサイズの場合はmm単位で表示
      const widthMm = Math.round(width * 25.4 / 72);
      const heightMm = Math.round(height * 25.4 / 72);
      displayName = `カスタム (${widthMm}×${heightMm}mm)`;
    } else {
      const orientationLabel = orientation === 'landscape' ? '横' : '縦';
      displayName = `${detectedSize} ${orientationLabel}`;
    }
    
    return NextResponse.json({
      detectedSize,
      displayName,
      width: Math.round(width),
      height: Math.round(height),
      orientation,
    });
    
  } catch (error) {
    console.error('[PDF Detect Size] Error:', error);
    return NextResponse.json(
      { error: 'Failed to detect PDF size' },
      { status: 500 }
    );
  }
}
