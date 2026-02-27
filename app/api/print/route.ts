import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

interface PrintRequest {
  pdfPath: string;         // サーバー上の PDF パス（例: /uploads/xxx.pdf）
  printerName?: string;    // プリンター名（省略時はデフォルトプリンター）
  copies?: number;         // 部数（デフォルト 1）
  duplex?: boolean;        // 両面印刷フラグ（Linux のみ対応）
  colorMode?: "color" | "mono";  // カラー / モノクロ
}

/** POST /api/print - サーバーサイドで PDF を印刷ジョブとして送信 */
export async function POST(req: NextRequest) {
  try {
    const body: PrintRequest = await req.json();
    const { pdfPath, printerName, copies = 1, duplex = false } = body;

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
      await printWindows(absolutePath, printerName, copies);
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
  copies: number
) {
  // ① SumatraPDF によるサイレント印刷（推奨）
  const sumatraPath = await findSumatraPDF();
  if (sumatraPath) {
    const printerArg = printerName ? `-print-to "${printerName}"` : "-print-to-default";
    const cmd = `"${sumatraPath}" ${printerArg} -silent "${filePath}"`;
    for (let i = 0; i < copies; i++) {
      await execAsync(cmd, { timeout: 60000 });
    }
    return;
  }

  // ② Adobe Acrobat / Acrobat Reader によるサイレント印刷
  const acrobatPath = await findAcrobat();
  if (acrobatPath) {
    // /t "file" "printer" でダイアログなしに静かに印刷
    const printerArg = printerName ? ` "${printerName}"` : "";
    const cmd = `"${acrobatPath}" /t "${filePath}"${printerArg}`;
    for (let i = 0; i < copies; i++) {
      await execAsync(cmd, { timeout: 60000 });
      // Acrobat は起動後すぐ終了することがあるため少し待機
      await new Promise((r) => setTimeout(r, 3000));
    }
    return;
  }

  // ③ Foxit Reader によるサイレント印刷
  const foxitPath = await findFoxitReader();
  if (foxitPath) {
    const printerArg = printerName ? ` "${printerName}"` : "";
    const cmd = `"${foxitPath}" /t "${filePath}"${printerArg}`;
    for (let i = 0; i < copies; i++) {
      await execAsync(cmd, { timeout: 60000 });
      await new Promise((r) => setTimeout(r, 3000));
    }
    return;
  }

  // ④ どのPDFビューアーも見つからない場合
  throw new Error(
    "サイレント印刷に対応するPDFビューアーが見つかりません。" +
    "SumatraPDF (https://www.sumatrapdfreader.org/) をインストールしてください。"
  );
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
