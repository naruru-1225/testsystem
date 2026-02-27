import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

/**
 * 用紙サイズの定義（ポイント単位：1pt = 1/72 inch）
 */
export const PAPER_SIZES = {
  A3: { width: 842, height: 1191 },   // 297 x 420 mm
  A4: { width: 595, height: 842 },    // 210 x 297 mm
  A5: { width: 420, height: 595 },    // 148 x 210 mm (#15)
  B4: { width: 729, height: 1032 },   // 257 x 364 mm
  B5: { width: 516, height: 729 },    // 182 x 257 mm
  Letter: { width: 612, height: 792 }, // 215.9 x 279.4 mm (#15)
} as const;

export type PaperSize = keyof typeof PAPER_SIZES;

/** mmをptに変換 */
export function mmToPt(mm: number): number {
  return Math.round((mm / 25.4) * 72);
}

/**
 * PDFを指定した用紙サイズに変換（縦横自動判定対応）
 * @param inputPath 元PDFのパス
 * @param outputPath 出力PDFのパス
 * @param targetSize 変換先の用紙サイズ
 */
export async function convertPdfSizeCustom(
  inputPath: string,
  outputPath: string,
  widthPt: number,
  heightPt: number
): Promise<void> {
  const customSize = { width: widthPt, height: heightPt };
  await _convertPdfWithDims(inputPath, outputPath, customSize, "CUSTOM");
}

export async function convertPdfSize(
  inputPath: string,
  outputPath: string,
  targetSize: PaperSize
): Promise<void> {
  await _convertPdfWithDims(inputPath, outputPath, PAPER_SIZES[targetSize], targetSize);
}

async function _convertPdfWithDims(
  inputPath: string,
  outputPath: string,
  targetDimsBase: { width: number; height: number },
  label: string
): Promise<void> {
  const targetSize = label as PaperSize;
  try {
    // 元PDFを読み込み
    const existingPdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    // 新しいPDFを作成
    const newPdf = await PDFDocument.create();
    
    // 各ページを変換
    const pages = pdfDoc.getPages();
    
    for (let i = 0; i < pages.length; i++) {
      const originalPage = pages[i];
      const { width: origWidth, height: origHeight } = originalPage.getSize();
      
      // 元ページの向きを判定
      const isOriginalLandscape = origWidth > origHeight;
      
      // ターゲットサイズの取得（向きに応じて回転）
      let targetDims: { width: number; height: number };
      if (isOriginalLandscape) {
        // 横向きの場合は幅と高さを入れ替え
        targetDims = { width: targetDimsBase.height, height: targetDimsBase.width };
      } else {
        targetDims = { width: targetDimsBase.width, height: targetDimsBase.height };
      }
      
      // スケール計算（よりフィットする方を選択）
      const scaleX = targetDims.width / origWidth;
      const scaleY = targetDims.height / origHeight;
      
      // 両方のスケールがほぼ同じ（差が0.5%以内）の場合は大きい方を使用
      // これにより余白を最小化
      const scaleDiff = Math.abs(scaleX - scaleY);
      const avgScale = (scaleX + scaleY) / 2;
      const scale = (scaleDiff / avgScale < 0.005) ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
      
      console.log(`[PDF] Page ${i + 1}: Original ${origWidth.toFixed(0)}x${origHeight.toFixed(0)} (${isOriginalLandscape ? 'landscape' : 'portrait'}) -> Target ${label} ${targetDims.width}x${targetDims.height}, Scale: ${scale.toFixed(4)}`);
      
      // 新しいページを作成
      const newPage = newPdf.addPage([targetDims.width, targetDims.height]);
      
      // 元ページを埋め込み
      const [embeddedPage] = await newPdf.embedPdf(pdfDoc, [i]);
      
      // 中央配置で描画
      const scaledWidth = origWidth * scale;
      const scaledHeight = origHeight * scale;
      const x = (targetDims.width - scaledWidth) / 2;
      const y = (targetDims.height - scaledHeight) / 2;
      
      newPage.drawPage(embeddedPage, {
        x,
        y,
        width: scaledWidth,
        height: scaledHeight,
      });
    }
    
    // 出力ディレクトリが存在しない場合は作成
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 印刷設定を埋め込む（ViewerPreferences）
    // PrintScaling: None = 印刷時にスケーリングしない（実際のサイズで印刷）
    // これにより、プリンタがPDFのページサイズに合った用紙を選択する可能性が高まる
    const catalog = newPdf.catalog;
    const viewerPrefsDict = newPdf.context.obj({
      PrintScaling: 'None',           // 印刷時のスケーリングを無効化
      Duplex: 'None',                 // 両面印刷設定
      PickTrayByPDFSize: true,        // PDFのページサイズに基づいて給紙トレイを選択
    });
    catalog.set(newPdf.context.obj('ViewerPreferences'), viewerPrefsDict);
    
    console.log(`[PDF] Set ViewerPreferences: PrintScaling=None, PickTrayByPDFSize=true`);
    
    // PDFを保存
    const pdfBytes = await newPdf.save();
    fs.writeFileSync(outputPath, pdfBytes);
    
    console.log(`[PDF] Converted to ${targetSize}: ${outputPath}`);
  } catch (error) {
    console.error(`[PDF] Error converting PDF to ${targetSize}:`, error);
    throw error;
  }
}

/**
 * 元PDFのサイズと向きを検出
 * @param pdfPath PDFファイルのパス
 * @returns 検出されたサイズ名と向き、または 'CUSTOM'
 */
export async function detectPdfSize(pdfPath: string): Promise<PaperSize | 'CUSTOM'> {
  try {
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const firstPage = pdfDoc.getPages()[0];
    const { width, height } = firstPage.getSize();
    
    // 許容誤差（±5pt）
    const tolerance = 5;
    
    // 縦向きチェック
    for (const [sizeName, dims] of Object.entries(PAPER_SIZES)) {
      if (
        Math.abs(width - dims.width) < tolerance &&
        Math.abs(height - dims.height) < tolerance
      ) {
        return sizeName as PaperSize;
      }
    }
    
    // 横向きチェック（幅と高さを入れ替えて確認）
    for (const [sizeName, dims] of Object.entries(PAPER_SIZES)) {
      if (
        Math.abs(width - dims.height) < tolerance &&
        Math.abs(height - dims.width) < tolerance
      ) {
        return sizeName as PaperSize;
      }
    }
    
    return 'CUSTOM';
  } catch (error) {
    console.error('[PDF] Error detecting PDF size:', error);
    return 'CUSTOM';
  }
}
