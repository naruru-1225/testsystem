import { NextResponse } from "next/server";
import { backupService } from "@/lib/services/backupService";
import { withErrorHandling, validationError } from "@/lib/api-utils";
import fs from "fs";

/**
 * バックアップからテストリストを取得するAPI
 * POST /api/backup/restore
 */
export const POST = withErrorHandling(async (request: Request) => {
  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return validationError("ファイルが選択されていません");
  }

  // ファイルの拡張子チェック
  if (!file.name.endsWith(".db")) {
    return validationError("データベースファイル(.db)を選択してください");
  }

  let tempDbPath: string | null = null;

  try {
    tempDbPath = await backupService.saveTempBackup(file);
    const testsWithDetails = backupService.getTestsFromBackup(tempDbPath);

    return NextResponse.json({
      tests: testsWithDetails,
      count: testsWithDetails.length,
    });
  } finally {
    // 一時ファイルを削除
    if (tempDbPath && fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  }
});
