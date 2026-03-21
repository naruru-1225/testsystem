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

type ColorMode = "color" | "mono";

type NormalizedPrintRequest = {
  pdfPath: string;
  printerName?: string;
  copies: number;
  duplex: boolean;
  colorMode: ColorMode;
  pageRange: string;
  paperSize: string;
  collate: boolean;
};

class PrintApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status = 500, code = "PRINT_ERROR", details?: unknown) {
    super(message);
    this.name = "PrintApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const PAGE_RANGE_PATTERN = /^\s*(\d+|\d*-\d*)(\s*,\s*(\d+|\d*-\d*))*\s*$/;

function normalizePaperSize(paperSize?: string): string {
  const value = (paperSize || "").trim();
  if (!value) return "";

  const upper = value.toUpperCase();
  // Sumatra と PowerShell 層での一貫性を決めるため、内部値は小文字統一
  // Sumatra 公式非対応: b4, b5
  // PowerShell 符を後掺: "B4" → "b4" に変換しPowerShell致まで一貫性を維持
  if (upper === "A3") return "a3";
  if (upper === "A4") return "a4";
  if (upper === "A5") return "a5";
  if (upper === "A6") return "a6";
  if (upper === "B4") return "b4";
  if (upper === "B5") return "b5";
  if (upper === "LETTER") return "letter";
  if (upper === "LEGAL") return "legal";
  if (upper === "TABLOID") return "tabloid";
  if (upper === "STATEMENT") return "statement";

  throw new PrintApiError(
    `未対応の用紙サイズです: ${value}`,
    400,
    "PRINT_INVALID_PAPER_SIZE",
    { allowed: ["A3", "A4", "A5", "A6", "B4", "B5", "Letter", "Legal", "Tabloid", "Statement"] }
  );
}

function normalizePrintRequest(body: PrintRequest): NormalizedPrintRequest {
  if (!body?.pdfPath || typeof body.pdfPath !== "string") {
    throw new PrintApiError("pdfPath は必須です", 400, "PRINT_INVALID_PDF_PATH");
  }

  const copiesRaw = Number(body.copies ?? 1);
  const copies = Number.isFinite(copiesRaw) ? Math.floor(copiesRaw) : 1;
  if (copies < 1 || copies > 999) {
    throw new PrintApiError("部数は1〜999の範囲で指定してください", 400, "PRINT_INVALID_COPIES");
  }

  const colorMode: ColorMode = body.colorMode === "color" ? "color" : "mono";
  const duplex = Boolean(body.duplex);
  const collate = body.collate !== false;
  const pageRange = (body.pageRange || "").trim();
  if (pageRange && !PAGE_RANGE_PATTERN.test(pageRange)) {
    throw new PrintApiError(
      "ページ範囲の形式が不正です。例: 1-3, 5, 7-",
      400,
      "PRINT_INVALID_PAGE_RANGE"
    );
  }

  return {
    pdfPath: body.pdfPath,
    printerName: body.printerName?.trim() || undefined,
    copies,
    duplex,
    colorMode,
    pageRange,
    paperSize: normalizePaperSize(body.paperSize),
    collate,
  };
}

/** POST /api/print - サーバーサイドで PDF を印刷ジョブとして送信 */
export async function POST(req: NextRequest) {
  const requestId = `print_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const body: PrintRequest = await req.json();
    const options = normalizePrintRequest(body);
    const { pdfPath, printerName, copies, duplex, colorMode, pageRange, paperSize, collate } = options;

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
      console.info("[print] API received options", { copies, pageRange, collate, duplex, colorMode, paperSize });

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
      console.info("[print] windows print start", { printerName, copies, duplex, colorMode, pageRange, paperSize, collate });
      await printWindows(absolutePath, printerName, copies, duplex, colorMode, pageRange, paperSize, collate);
      console.info("[print] windows print complete");
    } else {
      // Linux / macOS: lp コマンドで印刷
      await printUnix(absolutePath, printerName, copies, duplex);
    }

    return NextResponse.json({ success: true, message: "印刷ジョブを送信しました", requestId });
  } catch (error) {
    console.error("印刷エラー:", { requestId, error });
    if (error instanceof PrintApiError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          requestId,
          details: error.details,
        },
        { status: error.status }
      );
    }
    const message = error instanceof Error ? error.message : "不明なエラー";
    return NextResponse.json(
      {
        error: `印刷に失敗しました: ${message}`,
        code: "PRINT_INTERNAL_ERROR",
        requestId,
      },
      { status: 500 }
    );
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
    await ensureExecutableExists(sumatraPath, "PRINT_SUMATRA_NOT_FOUND");
    if (printerName) {
      await ensurePrinterExists(printerName);
    }
    console.info("[print] backend=sumatra", { sumatraPath, printerName, duplex, colorMode, paperSize });
      console.info("[print] buildPrintPdf input", { copies, pageRange, collate, duplex, filePath });
    // 部数・ページ範囲・丁合を一時PDFに埋め込む（両面時の並びもここで最適化）
    const { path: printPath, isTemp } = await buildPrintPdf(filePath, pageRange, copies, collate, duplex);
      console.info("[print] buildPrintPdf output", { printPath, isTemp, pdfWasModified: isTemp });
    try {
      const colorSetting = colorMode === "color" ? "color" : "monochrome";
      const duplexSetting = duplex ? "duplexlong" : "simplex";
      const paperSetting = paperSize ? `paper=${paperSize}` : "";
      const settingsParts = [colorSetting, duplexSetting, paperSetting].filter(Boolean).join(",");
      const args: string[] = [
        ...(printerName ? ["-print-to", printerName] : ["-print-to-default"]),
        ...(settingsParts ? ["-print-settings", settingsParts] : []),
        "-silent",
        printPath,
      ];
      await runSumatraPrint(sumatraPath, args, {
        printerName: printerName || "(default)",
        settings: settingsParts,
        printPath,
      });
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

async function ensureExecutableExists(exePath: string, code: string): Promise<void> {
  if (!fs.existsSync(exePath)) {
    throw new PrintApiError(`実行ファイルが見つかりません: ${exePath}`, 500, code, { exePath });
  }
}

async function ensurePrinterExists(printerName: string): Promise<void> {
  const escaped = printerName.replace(/'/g, "''");
  const script = `(Get-Printer -Name '${escaped}' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name -First 1)`;
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { timeout: 5000, windowsHide: true }
    );
    if (!stdout.trim()) {
      throw new PrintApiError(
        `指定プリンターが見つかりません: ${printerName}`,
        400,
        "PRINT_PRINTER_NOT_FOUND",
        { printerName }
      );
    }
  } catch (error) {
    if (error instanceof PrintApiError) throw error;
    throw new PrintApiError(
      "プリンター存在確認に失敗しました",
      500,
      "PRINT_PRINTER_CHECK_FAILED",
      { printerName, cause: error instanceof Error ? error.message : String(error) }
    );
  }
}

async function runSumatraPrint(
  sumatraPath: string,
  args: string[],
  context: { printerName: string; settings: string; printPath: string }
): Promise<void> {
  try {
    const { stdout, stderr } = await execFileAsync(sumatraPath, args, {
      timeout: 60000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });

    const out = (stdout || "").trim();
    const err = (stderr || "").trim();
    const combined = `${out}\n${err}`.trim();
    const suspicious = /(error|failed|cannot|invalid|unknown|not found)/i.test(combined);

    if (suspicious) {
      throw new PrintApiError(
        "SumatraPDF実行時にエラーが検出されました",
        500,
        "PRINT_SUMATRA_STDERR_ERROR",
        {
          printerName: context.printerName,
          settings: context.settings,
          printPath: context.printPath,
          stdout: out,
          stderr: err,
        }
      );
    }

    console.info("[print] sumatra command completed", {
      printerName: context.printerName,
      settings: context.settings,
      printPath: context.printPath,
      stderr: err || undefined,
    });
  } catch (error) {
    if (error instanceof PrintApiError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new PrintApiError(
      `SumatraPDF印刷に失敗しました: ${message}`,
      500,
      "PRINT_SUMATRA_EXEC_FAILED",
      {
        printerName: context.printerName,
        settings: context.settings,
        printPath: context.printPath,
        args,
      }
    );
  }
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
  const { path: printFilePath, isTemp } = await buildPrintPdf(filePath, pageRange, copies, collate, duplex);

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
      // Acrobat/Foxit は /t 実行後に別プロセスで遅延読込する場合があるため、
      // 即時削除せず遅延削除にする。
      scheduleTempFileCleanup(printFilePath, 10 * 60 * 1000);
    }
  }
}

/**
 * 一時PDFの削除を遅延実行する（印刷処理の遅延読込対策）。
 */
function scheduleTempFileCleanup(filePath: string, delayMs: number): void {
  const timer = setTimeout(() => {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
  }, delayMs);
  // Node プロセス終了をブロックしない
  timer.unref?.();
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

  // PowerShell の Set-PrintConfiguration に渡す紙サイズを変換
  // Sumatra 内部値（小文字）から PowerShell 期待値（大文字）に変換
  let powerShellPaperSize = "";
  if (paperSize) {
    const psMap: Record<string, string> = {
      "a3": "A3",
      "a4": "A4",
      "a5": "A5",
      "a6": "A6",
      "b4": "B4",
      "b5": "B5",
      "letter": "Letter",
      "legal": "Legal",
      "tabloid": "Tabloid",
      "statement": "Statement",
    };
    powerShellPaperSize = psMap[paperSize.toLowerCase()] || "";
  }

  // 空パラメータで壊れないように1行で組み立てる
  const cmdParts = [
    `Set-PrintConfiguration -PrinterName '${escapedPrinter}'`,
    `-Color ${colorValue}`,
    `-DuplexingMode ${duplexMode}`,
    powerShellPaperSize ? `-PaperSize '${powerShellPaperSize}'` : "",
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
  collate: boolean,
  duplex: boolean
): Promise<{ path: string; isTemp: boolean }> {
  const pdfBytes = fs.readFileSync(filePath);
  const srcDoc = await PDFDocument.load(pdfBytes);
  const totalPages = srcDoc.getPageCount();

  // 印刷対象ページのインデックス（0始まり）
  const baseIndices = pageRange.trim()
    ? parsePageRange(pageRange.trim(), totalPages)
    : Array.from({ length: totalPages }, (_, i) => i);

  if (baseIndices.length === 0) {
    throw new Error("ページ範囲の指定が不正です。例: 1-3, 5, 7-");
  }

  // 部数1 かつ 全ページなら一時ファイル不要
  if (copies <= 1 && baseIndices.length === totalPages) {
    return { path: filePath, isTemp: false };
  }

  // ページ順序を構築（null は空白ページ挿入）
  const pageOrder: Array<number | null> = [];
  const normalizedCopies = Math.max(1, copies);

  if (collate) {
    // 丁合（123123…）
    for (let c = 0; c < normalizedCopies; c++) {
      pageOrder.push(...baseIndices);
      // 両面で奇数ページの場合、次の部の1ページ目が裏面に回らないよう空白を挿入
      if (duplex && baseIndices.length % 2 === 1 && c < normalizedCopies - 1) {
        pageOrder.push(null);
      }
    }
  } else if (duplex) {
    // 非丁合 + 両面時は「紙単位で繰り返し」
    // 例: 1,2,3,4 を4部 -> 12,12,12,12,34,34,34,34
    for (let i = 0; i < baseIndices.length; i += 2) {
      const front = baseIndices[i];
      const back = i + 1 < baseIndices.length ? baseIndices[i + 1] : null;
      for (let c = 0; c < normalizedCopies; c++) {
        pageOrder.push(front);
        pageOrder.push(back);
      }
    }
  } else {
    // 非丁合（片面）: 111222…
    for (const idx of baseIndices) {
      for (let c = 0; c < normalizedCopies; c++) pageOrder.push(idx);
    }
  }

  const newDoc = await PDFDocument.create();
  const toCopy = pageOrder.filter((v): v is number => v !== null);
  const copiedPages = await newDoc.copyPages(srcDoc, toCopy);
  let copyCursor = 0;
  for (const idx of pageOrder) {
    if (idx === null) {
      // 空白ページは最後に使ったページサイズを踏襲し、無ければA4
      const refIdx = baseIndices[baseIndices.length - 1] ?? 0;
      const refPage = srcDoc.getPage(refIdx);
      const { width, height } = refPage.getSize();
      newDoc.addPage([width, height]);
      continue;
    }
    newDoc.addPage(copiedPages[copyCursor++]);
  }
  const newBytes = await newDoc.save();
  const tempPath = path.join(
    os.tmpdir(),
    `print_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.pdf`
  );
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
  const localApp = process.env.LOCALAPPDATA || "";
  const userProfile = process.env.USERPROFILE || "";
  const candidates = [
    "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe",
    "C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe",
    localApp ? path.join(localApp, "SumatraPDF", "SumatraPDF.exe") : "",
    userProfile ? path.join(userProfile, "AppData", "Local", "SumatraPDF", "SumatraPDF.exe") : "",
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  try {
    const { stdout } = await execAsync("where SumatraPDF.exe", { timeout: 3000 });
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
