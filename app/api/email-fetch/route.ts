import { NextResponse } from "next/server";
import "@/lib/database"; // DB初期化（テーブル作成）を確実に実行
import { manualFetch } from "@/lib/emailPoller";
import { withErrorHandling } from "@/lib/api-utils";

/**
 * メール手動取得API
 * POST /api/email-fetch
 */
export const POST = withErrorHandling(async () => {
  const result = await manualFetch();

  return NextResponse.json({
    success: true,
    imported: result.imported,
    errors: result.errors,
    message:
      result.imported > 0
        ? `${result.imported}件のPDFを取り込みました`
        : "新しいPDFは見つかりませんでした",
  });
});
