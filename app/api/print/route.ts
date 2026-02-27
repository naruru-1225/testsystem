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

    // pdfPath が /api/pdf/sized?... の形式（サイズ変換API URL）の場合、
    // クエリパラメーターの pdfPath を抽出して実際のファイルパスを使用する
    let resolvedPdfPath = pdfPath;
    if (pdfPath.startsWith("/api/pdf/sized") || pdfPath.startsWith("/api/pdf/")) {
      try {
        const url = new URL(pdfPath, "http://localhost");
        const extracted = url.searchParams.get("pdfPath");
        if (extracted) {
          resolvedPdfPath = extracted;
        }
      } catch {
        // URLパースに失敗した場合はそのまま使用
      }
    }

    // pdfPath が /uploads/... の形式の場合、public フォルダ配下に解決
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
  // SumatraPDF が使えるか確認（サイレント印刷が可能なため推奨）
  const sumatraPath = await findSumatraPDF();

  if (sumatraPath) {
    // SumatraPDF によるサイレント印刷
    const printerArg = printerName ? `-print-to "${printerName}"` : "-print-to-default";
    const cmd = `"${sumatraPath}" ${printerArg} -silent "${filePath}"`;
    // 部数は SumatraPDF では複数回呼び出しで対応
    for (let i = 0; i < copies; i++) {
      await execAsync(cmd, { timeout: 60000 });
    }
  } else {
    // PowerShell の Start-Process -Verb Print にフォールバック
    const escapedPath = filePath.replace(/'/g, "''");
    let cmd: string;
    if (printerName) {
      // 特定プリンターへの印刷（レジストリ経由でデフォルト変更は避け、SumatraPDF 推奨）
      cmd = `powershell -NoProfile -Command "& { $printer = '${printerName.replace(/'/g, "''")}'; $file = '${escapedPath}'; Start-Process -FilePath $file -Verb Print -Wait }"`;
    } else {
      cmd = `powershell -NoProfile -Command "Start-Process -FilePath '${escapedPath}' -Verb Print -Wait"`;
    }
    for (let i = 0; i < copies; i++) {
      await execAsync(cmd, { timeout: 60000 });
    }
  }
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
  // PATH から探す
  try {
    const { stdout } = await execAsync("where SumatraPDF", { timeout: 3000 });
    const found = stdout.trim().split("\n")[0];
    if (found && fs.existsSync(found)) return found.trim();
  } catch {
    // 見つからない
  }
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
