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
}

/** POST /api/print - サーバーサイドで PDF を印刷ジョブとして送信 */
export async function POST(req: NextRequest) {
  try {
    const body: PrintRequest = await req.json();
    const { pdfPath, printerName, copies = 1, duplex = false, colorMode = "mono", pageRange = "", paperSize = "" } = body;

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
      await printWindows(absolutePath, printerName, copies, duplex, colorMode, pageRange, paperSize);
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
  paperSize: string = ""
) {
  // ① SumatraPDF によるサイレント印刷（推奨）
  const sumatraPath = await findSumatraPDF();
  if (sumatraPath) {
    const colorSetting = colorMode === "color" ? "color" : "monochrome";
    const duplexSetting = duplex ? "duplexlong" : "simplex";
    // 部数は Nx 形式（SumatraPDF ネイティブ）で指定。ループ不要
    const copiesSetting = copies > 1 ? `${copies}x` : "";
    // 用紙サイズ: paper=A4 形式
    const paperSetting = paperSize ? `paper=${paperSize}` : "";
    // ページ範囲: "1-3", "2-", "-5" など（空欄=全ページ）
    const pageRangeSetting = pageRange.trim();
    // 全設定をカンマ区切りで結合（空の項目は除外）
    const settingsParts = [pageRangeSetting, colorSetting, duplexSetting, copiesSetting, paperSetting]
      .filter(Boolean)
      .join(",");
    // execFile でシェルを経由しないことで引数が確実に渡る
    const args: string[] = [
      ...(printerName ? ["-print-to", printerName] : ["-print-to-default"]),
      "-print-settings", settingsParts,
      "-silent",
      filePath,
    ];
    await execFileAsync(sumatraPath, args, { timeout: 60000 });
    return;
  }

  // ② Adobe Acrobat / Acrobat Reader によるサイレント印刷
  const acrobatPath = await findAcrobat();
  if (acrobatPath) {
    await printWithAcrobat(acrobatPath, filePath, printerName, copies, duplex, colorMode, pageRange, paperSize);
    return;
  }

  // ③ Foxit Reader によるサイレント印刷
  const foxitPath = await findFoxitReader();
  if (foxitPath) {
    await printWithAcrobat(foxitPath, filePath, printerName, copies, duplex, colorMode, pageRange, paperSize);
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
 * - ページ範囲: pdf-lib でページを抽出して一時ファイルを作成
 * - カラー/両面/用紙: PowerShell Set-PrintConfiguration でプリンター設定を変更（印刷後復元）
 * - 部数: ループで複数ジョブ送信
 */
async function printWithAcrobat(
  viewerPath: string,
  filePath: string,
  printerName: string | undefined,
  copies: number,
  duplex: boolean,
  colorMode: "color" | "mono",
  pageRange: string,
  paperSize: string
) {
  let printFilePath = filePath;
  let tempFile: string | null = null;

  try {
    // ① ページ範囲が指定されている場合、pdf-lib でページ抽出
    const rangeStr = pageRange.trim();
    if (rangeStr) {
      const pdfBytes = fs.readFileSync(filePath);
      const srcDoc = await PDFDocument.load(pdfBytes);
      const totalPages = srcDoc.getPageCount();
      const pageIndices = parsePageRange(rangeStr, totalPages);

      if (pageIndices.length > 0 && pageIndices.length < totalPages) {
        const newDoc = await PDFDocument.create();
        const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
        copiedPages.forEach((p) => newDoc.addPage(p));
        const newBytes = await newDoc.save();
        tempFile = path.join(os.tmpdir(), `print_${Date.now()}.pdf`);
        fs.writeFileSync(tempFile, newBytes);
        printFilePath = tempFile;
      }
    }

    // ② PowerShell でプリンター設定を変更（カラー・両面・用紙サイズ）
    // Set-PrintConfiguration は Windows 8+ 標準搭載（PrintManagement モジュール）
    if (printerName) {
      const duplexMode = duplex ? "TwoSidedLongEdge" : "OneSided";
      const colorBool = colorMode === "color" ? "$true" : "$false";
      // 用紙サイズ: SumatraPDF と同じ名称を使う（A4, A3, Letter など）
      const paperLine = paperSize
        ? `-PaperSize '${paperSize}'`
        : "";
      // エラーは無視（プリンターが設定非対応の場合もあるため）
      const psScript = `
        try {
          Set-PrintConfiguration -PrinterName '${printerName.replace(/'/g, "''")}' \`
            -Color ${colorBool} \`
            -DuplexingMode '${duplexMode}' \`
            ${paperLine} \`
            -ErrorAction SilentlyContinue
        } catch {}
      `.trim();
      await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", psScript], { timeout: 10000 }).catch(() => {/* 設定失敗は無視 */});
    }

    // ③ Acrobat/Foxit で印刷（/t "file" ["printer"] 形式）
    for (let i = 0; i < copies; i++) {
      const acrobatArgs = printerName
        ? ["/t", printFilePath, printerName]
        : ["/t", printFilePath];
      await execFileAsync(viewerPath, acrobatArgs, { timeout: 60000 });
      // Acrobat は印刷キューに積んだ後すぐ終了するため少し待機
      await new Promise((r) => setTimeout(r, 4000));
    }
  } finally {
    // ④ 一時ファイルを削除
    if (tempFile && fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
    }
  }
}

/**
 * "1-5", "3-", "-5", "2" 形式のページ範囲文字列を 0-indexed の配列に変換
 */
function parsePageRange(range: string, totalPages: number): number[] {
  const trimmed = range.trim();
  // "N" 単体（単ページ）
  const single = trimmed.match(/^(\d+)$/);
  if (single) {
    const n = parseInt(single[1]) - 1;
    return n >= 0 && n < totalPages ? [n] : [];
  }
  // "N-M", "N-", "-M" 形式
  const rangeMatch = trimmed.match(/^(\d*)-(\d*)$/);
  if (!rangeMatch) return [];
  const from = rangeMatch[1] ? parseInt(rangeMatch[1]) - 1 : 0;
  const to = rangeMatch[2] ? parseInt(rangeMatch[2]) - 1 : totalPages - 1;
  const result: number[] = [];
  for (let i = Math.max(0, from); i <= Math.min(totalPages - 1, to); i++) {
    result.push(i);
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
