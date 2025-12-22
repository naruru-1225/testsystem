import { NextResponse } from "next/server";
import { testRepository } from "@/lib/repositories/testRepository";
import { withErrorHandling } from "@/lib/api-utils";

/**
 * 学年・科目カテゴリ取得API
 * GET /api/categories
 * テストが存在する学年・科目のみを返す
 */
export const GET = withErrorHandling(async () => {
  const categories = testRepository.getCategories();
  return NextResponse.json(categories);
});
