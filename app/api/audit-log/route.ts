import { NextResponse } from "next/server";
import { auditService } from "@/lib/services/auditService";
import { withErrorHandling } from "@/lib/api-utils";

/**
 * 監査ログ取得API (#103)
 * GET /api/audit-log
 */
export const GET = withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const logs = auditService.getRecent(limit);
  return NextResponse.json(logs);
});
