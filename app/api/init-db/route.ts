import { NextResponse } from "next/server";
import { initializePostgres } from "@/lib/init-postgres";
import { withErrorHandling, validationError } from "@/lib/api-utils";

/**
 * データベース初期化API
 * GET /api/init-db
 * Vercel環境でPostgreSQLを初期化
 */
export const GET = withErrorHandling(async () => {
  if (!process.env.POSTGRES_URL) {
    return validationError("PostgreSQL not configured");
  }

  await initializePostgres();

  return NextResponse.json({
    message: "Database initialized successfully",
  });
});
