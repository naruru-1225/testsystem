import { NextRequest, NextResponse } from "next/server";
import { exec, execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import os from "os";
import { PDFDocument } from "pdf-lib";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

interface PrintRequest {
  pdfPath: string;         // サーバー上の PDF パス（例: /uploads/xxx.pdf）
  printerName?: string;    // プリンター名（省略時はデフォルトプリンター）
  copies?: number;         // 部数（デフォルト 1）
  duplex?: boolean;        // 両面印刷フラグ
  colorMode?: "color" | "mono";  // カラー / モノクロ
  pageRange?: string;      // 印刷ページ範囲（例: "1-3", "2-", "-5", "" で全ページ）
  paperSize?: string;      // 用紙サイズ（例: "A4", "A3", "Letter"）
  collate?: boolean;       // 丁合: true=123123...(部単位), false=111222...(ページ順)
}

/** POST /api/print - サーバーサイドで PDF を印刷ジョブとして送信 */
export async function POST(req: NextRequest) {
  try {
    const body: PrintRequest = await req.json();
    const { pdfPath, printerName, copies = 1, duplex = false, colorMode = "mono", pageRange = "", paperSize = "", collate = true } = body;

    if (!pdfPath) {
      return NextResponse.json({ error: "pdfPath は必須です" }, { status: 400 });
    }

    // public フォルダ基点の絶対パスを解決
    const publicDir = path.join(process.cwd(), "public");

    // pdfPath を実際のファイルパス（/uploads/... 形式）に正規化する
    let resolvedPdfPath = pdfPath;

    // ① フルURL: http(s)://host/api/pdf/pdfs/xxx.pdf → /api/pdf/pdfs/xxx.pdf
    if (resolvedPdfPath.startsWith("http://") || resolvedPdfPath.startsWith("https://")) {
      try {
        const url = new URL(resolvedPdfPath);
        resolvedPdfPath = url.pathname + (url.search || "");
      } catch { /* ignore */ }
    }

    // ② /api/pdf/sized?pdfPath=... → クエリパラメーターから抽出
    if (resolvedPdfPath.startsWith("/api/pdf/sized") || resolvedPdfPath.includes("/api/pdf/sized")) {
      try {
        const url = new URL(resolvedPdfPath, "http://localhost");
        const extracted = url.searchParams.get("pdfPath");
        if (extracted) resolvedPdfPath = extracted;
      } catch { /* ignore */ }
    }
    // ③ /api/pdf/pdfs/xxx.pdf → /uploads/pdfs/xxx.pdf（API経由パスを実ファイルパスに変換）
    else if (resolvedPdfPath.startsWith("/api/pdf/")) {
      resolvedPdfPath = resolvedPdfPath.replace("/api/pdf/", "/uploads/");
    }

    // /uploads/... を public/ 配下の絶対パスに変換
    const relPath = resolvedPdfPath.startsWith("/") ? resolvedPdfPath.slice(1) : resolvedPdfPath;
    const absolutePath = path.resolve(publicDir, relPath);

    // パストラバーサル対策：public フォルダ外のファイルへのアクセスを拒否
    if (!absolutePath.startsWith(publicDir)) {
      return NextResponse.json({ error: "不正なファイルパスです" }, { status: 400 });
    }

    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json(
        { error: `ファイルが見つかりません: ${resolvedPdfPath}（元のパス: ${pdfPath}）` },
        { status: 404 }
      );
    }

    if (process.platform === "win32") {
      // Windows: SumatraPDF (インストール済みの場合) または PowerShell で印刷
      await printWindows(absolutePath, printerName, copies, duplex, colorMode, pageRange, paperSize, collate);
    } else {
      // Linux / macOS: lp コマンドで印刷
      await printUnix(absolutePath, printerName, copies, duplex);
    }

    return NextResponse.json({ success: true, message: "印刷ジョブを送信しました" });
  } catch (error) {
    console.error("印刷エラー:", error);
    const message = error instanceof Error ? error.message : "不明なエラー";
    return NextResponse.json({ error: `印刷に失敗しました: ${message}` }, { status: 500 });
  }
}

async function printWindows(
  filePath: string,
  printerName: string | undefined,
  copies: number,
  duplex: boolean = false,
  colorMode: "color" | "mono" = "mono",
  pageRange: string = "",
  paperSize: string = "",
  collate: boolean = true
) {
  // ① SumatraPDF によるサイレント印刷（推奨）
  const sumatraPath = await findSumatraPDF();
  if (sumatraPath) {
    // 部数・ページ範囲・丁合を一時PDFに埋め込む（SumatraPDFのNxは丁合制御不可のため）
    const { path: printPath, isTemp } = await buildPrintPdf(filePath, pageRange, copies, collate);
    try {
      const colorSetting = colorMode === "color" ? "color" : "monochrome";
      const duplexSetting = duplex ? "duplexlong" : "simplex";
      const paperSetting = paperSize ? `paper=${paperSize}` : "";
      const settingsParts = [colorSetting, duplexSetting, paperSetting].filter(Boolean).join(",");
      const args: string[] = [
        ...(printerName ? ["-print-to", printerName] : ["-print-to-default"]),
        "-print-settings", settingsParts,
        "-silent",
        printPath,
      ];
      await execFileAsync(sumatraPath, args, { timeout: 60000 });
    } finally {
      if (isTemp && fs.existsSync(printPath)) {
        try { fs.unlinkSync(printPath); } catch { /* ignore */ }
      }
    }
    return;
  }

  // ② Adobe Acrobat / Acrobat Reader によるサイレント印刷
  const acrobatPath = await findAcrobat();
  if (acrobatPath) {
    await printWithAcrobat(acrobatPath, filePath, printerName, copies, duplex, colorMode, pageRange, paperSize, collate);
    return;
  }

  // ③ Foxit Reader によるサイレント印刷
  const foxitPath = await findFoxitReader();
  if (foxitPath) {
    await printWithAcrobat(foxitPath, filePath, printerName, copies, duplex, colorMode, pageRange, paperSize, collate);
    return;
  }

  // ④ どのPDFビューアーも見つからない場合
  throw new Error(
    "サイレント印刷に対応するPDFビューアーが見つかりません。" +
    "SumatraPDF (https://www.sumatrapdfreader.org/) をインストールしてください。"
  );
}

/**
 * Adobe Acrobat / Foxit Reader などによる印刷。
 * 部数・ページ範囲・丁合はすべて一時PDFに埋め込み、単一ジョブとして送信する。
 */
async function printWithAcrobat(
  viewerPath: string,
  filePath: string,
  printerName: string | undefined,
  copies: number,
  duplex: boolean,
  colorMode: "color" | "mono",
  pageRange: string,
  paperSize: string,
  collate: boolean
) {
  const { path: printFilePath, isTemp } = await buildPrintPdf(filePath, pageRange, copies, collate);

  try {
    // PowerShell でプリンター設定を変更（カラー・両面・用紙サイズ）
    // 指定がなければ既定プリンターに適用を試みる
    const effectivePrinter = await resolvePrinterName(printerName);
    if (effectivePrinter) {
      await applyPrinterConfiguration(effectivePrinter, duplex, colorMode, paperSize);
    }

    // Acrobat/Foxit で印刷（/t "file" ["printer"] 形式、1ジョブのみ）
    const acrobatArgs = printerName
      ? ["/t", printFilePath, printerName]
      : ["/t", printFilePath];
    await execFileAsync(viewerPath, acrobatArgs, { timeout: 60000 });
    // Acrobat は印刷キューに積んだ後すぐ終了するため少し待機
    await new Promise((r) => setTimeout(r, 4000));
  } finally {
    if (isTemp && fs.existsSync(printFilePath)) {
      try { fs.unlinkSync(printFilePath); } catch { /* ignore */ }
    }
  }
}

/**
 * 指定プリンター名があればそれを使用し、なければ既定プリンター名を取得する。
 */
async function resolvePrinterName(printerName?: string): Promise<string | null> {
  if (printerName?.trim()) return printerName.trim();
  try {
    const script = "(Get-Printer | Where-Object { $_.Default -eq $true } | Select-Object -ExpandProperty Name -First 1)";
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { timeout: 5000 }
    );
    const name = stdout.trim();
    return name || null;
  } catch {
    return null;
  }
}

/**
 * Adobe/Foxit 経路でも設定反映させるため、プリンター設定を明示適用する。
 */
async function applyPrinterConfiguration(
  printerName: string,
  duplex: boolean,
  colorMode: "color" | "mono",
  paperSize: string
): Promise<void> {
  const duplexMode = duplex ? "TwoSidedLongEdge" : "OneSided";
  const colorValue = colorMode === "color" ? "$true" : "$false";
  const escapedPrinter = printerName.replace(/'/g, "''");

  // 空パラメータで壊れないように1行で組み立てる
  const cmdParts = [
    `Set-PrintConfiguration -PrinterName '${escapedPrinter}'`,
    `-Color ${colorValue}`,
    `-DuplexingMode ${duplexMode}`,
    paperSize ? `-PaperSize ${paperSize}` : "",
    "-ErrorAction SilentlyContinue",
  ].filter(Boolean);
  const script = `try { ${cmdParts.join(" ")} } catch {}`;

  try {
    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { timeout: 10000 }
    );
  } catch {
    // 非対応プリンターでも印刷自体は継続
  }
}

/**
 * 部数・ページ範囲・丁合方式を1つのPDFに展開して返す。
 * 変更不要な場合（部数1・全ページ）はオリジナルをそのまま返す（isTemp=false）。
 *
 * collate=true  → 丁合（部単位）: 1,2,3,1,2,3,… (123123…)
 * collate=false → 非丁合（ページ順）: 1,1,2,2,3,3,… (111222…)
 */
async function buildPrintPdf(
  filePath: string,
  pageRange: string,
  copies: number,
  collate: boolean
): Promise<{ path: string; isTemp: boolean }> {
  const pdfBytes = fs.readFileSync(filePath);
  const srcDoc = await PDFDocument.load(pdfBytes);
  const totalPages = srcDoc.getPageCount();

  // 印刷対象ページのインデックス（0始まり）
  const baseIndices = pageRange.trim()
    ? parsePageRange(pageRange.trim(), totalPages)
    : Array.from({ length: totalPages }, (_, i) => i);

  if (baseIndices.length === 0) {
    return { path: filePath, isTemp: false };
  }

  // 部数1 かつ 全ページなら一時ファイル不要
  if (copies <= 1 && baseIndices.length === totalPages) {
    return { path: filePath, isTemp: false };
  }

  // ページ順序を構築
  let pageOrder: number[];
  if (collate) {
    // 丁合（123123…）: 全ページが揃ったセットを N 回繰り返す
    pageOrder = [];
    for (let c = 0; c < copies; c++) pageOrder.push(...baseIndices);
  } else {
    // 非丁合（111222…）: 各ページを N 枚ずつ繰り返す
    pageOrder = [];
    for (const idx of baseIndices)
      for (let c = 0; c < copies; c++) pageOrder.push(idx);
  }

  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(srcDoc, pageOrder);
  copiedPages.forEach((p) => newDoc.addPage(p));
  const newBytes = await newDoc.save();
  const tempPath = path.join(os.tmpdir(), `print_${Date.now()}.pdf`);
  fs.writeFileSync(tempPath, newBytes);
  return { path: tempPath, isTemp: true };
}

/**
 * "1-5", "3-", "-5", "2", "1-3,5,7-9" 形式のページ範囲文字列を 0-indexed の配列に変換
 */
function parsePageRange(range: string, totalPages: number): number[] {
  const result: number[] = [];
  const seen = new Set<number>();
  for (const segment of range.split(",")) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const single = trimmed.match(/^(\d+)$/);
    if (single) {
      const n = parseInt(single[1]) - 1;
      if (n >= 0 && n < totalPages && !seen.has(n)) { result.push(n); seen.add(n); }
      continue;
    }
    const rangeMatch = trimmed.match(/^(\d*)-(\d*)$/);
    if (!rangeMatch) continue;
    const from = rangeMatch[1] ? parseInt(rangeMatch[1]) - 1 : 0;
    const to = rangeMatch[2] ? parseInt(rangeMatch[2]) - 1 : totalPages - 1;
    for (let i = Math.max(0, from); i <= Math.min(totalPages - 1, to); i++) {
      if (!seen.has(i)) { result.push(i); seen.add(i); }
    }
  }
  return result;
}

async function printUnix(
  filePath: string,
  printerName: string | undefined,
  copies: number,
  duplex: boolean
) {
  const printerArg = printerName ? `-d "${printerName}"` : "";
  const copiesArg = copies > 1 ? `-n ${copies}` : "";
  const duplexArg = duplex ? "-o sides=two-sided-long-edge" : "";
  const cmd = `lp ${printerArg} ${copiesArg} ${duplexArg} "${filePath}"`;
  await execAsync(cmd.trim().replace(/\s+/g, " "), { timeout: 60000 });
}

/** SumatraPDF の実行ファイルパスを探す */
async function findSumatraPDF(): Promise<string | null> {
  const candidates = [
    "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe",
    "C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const { stdout } = await execAsync("where SumatraPDF", { timeout: 3000 });
    const found = stdout.trim().split("\n")[0];
    if (found && fs.existsSync(found.trim())) return found.trim();
  } catch { /* 見つからない */ }
  return null;
}

/** Adobe Acrobat / Acrobat Reader の実行ファイルパスを探す */
async function findAcrobat(): Promise<string | null> {
  const candidates = [
    // Acrobat Reader DC
    "C:\\Program Files (x86)\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe",
    "C:\\Program Files\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe",
    // Acrobat DC (Pro)
    "C:\\Program Files (x86)\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe",
    "C:\\Program Files\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe",
    // 旧バージョン
    "C:\\Program Files (x86)\\Adobe\\Reader 11.0\\Reader\\AcroRd32.exe",
    "C:\\Program Files (x86)\\Adobe\\Reader 10.0\\Reader\\AcroRd32.exe",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const { stdout } = await execAsync("where AcroRd32", { timeout: 3000 });
    const found = stdout.trim().split("\n")[0];
    if (found && fs.existsSync(found.trim())) return found.trim();
  } catch { /* 見つからない */ }
  return null;
}

/** Foxit Reader の実行ファイルパスを探す */
async function findFoxitReader(): Promise<string | null> {
  const candidates = [
    "C:\\Program Files (x86)\\Foxit Software\\Foxit Reader\\FoxitReader.exe",
    "C:\\Program Files\\Foxit Software\\Foxit Reader\\FoxitReader.exe",
    "C:\\Program Files (x86)\\Foxit Software\\Foxit PDF Reader\\FoxitPDFReader.exe",
    "C:\\Program Files\\Foxit Software\\Foxit PDF Reader\\FoxitPDFReader.exe",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const { stdout } = await execAsync("where FoxitReader", { timeout: 3000 });
    const found = stdout.trim().split("\n")[0];
    if (found && fs.existsSync(found.trim())) return found.trim();
  } catch { /* 見つからない */ }
  return null;
}

/** GET /api/print/settings - 保存された印刷設定を取得 */
export async function GET() {
  try {
    // TODO: system_settings テーブルから取得する実装を追加
    return NextResponse.json({ printerName: "", copies: 1, duplex: false, colorMode: "mono" });
  } catch {
    return NextResponse.json({ printerName: "", copies: 1, duplex: false, colorMode: "mono" });
  }
}
