import { NextResponse } from "next/server";
import { folderRepository } from "@/lib/repositories/folderRepository";
import { withErrorHandling, validationError } from "@/lib/api-utils";

/**
 * フォルダ一覧取得API
 * GET /api/folders
 */
export const GET = withErrorHandling(async () => {
  const folders = folderRepository.getAll();
  return NextResponse.json(folders);
});

/**
 * フォルダ新規作成API
 * POST /api/folders
 */
export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const { name, parentId = null } = body;

  if (!name) {
    return validationError("フォルダ名が入力されていません");
  }

  // 同じ親フォルダ内での重複チェック
  const exists = folderRepository.checkNameExists(name, parentId);
  if (exists) {
    return validationError("同じ親フォルダ内に同名のフォルダが既に存在します");
  }

  const newFolder = folderRepository.create(name, parentId);
  return NextResponse.json(newFolder, { status: 201 });
});

/**
 * フォルダ順序更新API
 * PUT /api/folders
 * @body { folderIds: number[] } - 新しい順序のフォルダID配列
 */
export const PUT = withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const { folderIds } = body;

  if (!Array.isArray(folderIds)) {
    return validationError("無効なリクエスト形式です");
  }

  folderRepository.updateOrder(folderIds);
  return NextResponse.json({ success: true });
});

