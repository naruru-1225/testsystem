import { NextResponse } from "next/server";
import { backupService } from "@/lib/services/backupService";
import { withErrorHandling, notFoundError } from "@/lib/api-utils";

/**
 * バックアップ作成API
 * GET /api/backup/create
 * SQLiteのVACUUM INTOコマンドを使用して完全なバックアップを作成
 */
export const GET = withErrorHandling(async () => {
  try {
    const { buffer, filename } = backupService.createDownloadableBackup();

    return new NextResponse(buffer, {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/x-sqlite3",
      },
    });
  } catch (error: any) {
    if (error.message === "データベースファイルが見つかりません") {
      return notFoundError(error.message);
    }
    throw error;
  }
});
