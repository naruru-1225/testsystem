import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/** GET /api/print/printers - システムにインストールされたプリンター一覧を取得 */
export async function GET() {
  try {
    let printers: string[] = [];

    if (process.platform === "win32") {
      // Windows: PowerShell でプリンター一覧取得
      const { stdout } = await execAsync(
        'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json"',
        { timeout: 10000 }
      );
      const trimmed = stdout.trim();
      if (trimmed) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          printers = parsed.filter((p): p is string => typeof p === "string");
        } else if (typeof parsed === "string") {
          printers = [parsed];
        }
      }
    } else {
      // Linux / macOS: lpstat でプリンター一覧取得
      try {
        const { stdout } = await execAsync("lpstat -a 2>/dev/null || lpstat -p 2>/dev/null", {
          timeout: 10000,
        });
        const lines = stdout.split("\n").filter(Boolean);
        printers = lines
          .map((line) => {
            const match = line.match(/^(\S+)/);
            return match ? match[1] : null;
          })
          .filter((p): p is string => p !== null);
      } catch {
        // lpstat が使えない環境では空リストを返す
        printers = [];
      }
    }

    return NextResponse.json({ printers });
  } catch (error) {
    console.error("プリンター一覧取得エラー:", error);
    return NextResponse.json(
      { error: "プリンター一覧の取得に失敗しました", printers: [] },
      { status: 500 }
    );
  }
}
