import { NextResponse } from "next/server";
import { testRepository } from "@/lib/repositories/testRepository";
import { withErrorHandling, validationError } from "@/lib/api-utils";

/**
 * バックアップから選択したテストを復元するAPI
 * POST /api/backup/restore-test
 */
export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const { test } = body;

  if (!test) {
    return validationError("テストデータが指定されていません");
  }

  // 同じIDのテストが既に存在するかチェック
  const existingTest = testRepository.getById(test.id);
  if (existingTest) {
    return validationError("このテストは既に存在します");
  }

  // テストを復元
  const result = testRepository.restore(test);

  return NextResponse.json(result);
});
