import { NextResponse } from "next/server";
import { folderRepository } from "@/lib/repositories/folderRepository";
import {
  withErrorHandling,
  validationError,
  notFoundError,
} from "@/lib/api-utils";

/**
 * フォルダ取得API
 * GET /api/folders/[id]
 */
export const GET = withErrorHandling(async (request: Request, { params }: any) => {
  const { id } = await params;
  const folderId = parseInt(id);

  if (isNaN(folderId)) {
    return validationError("無効なフォルダIDです");
  }

  const folder = folderRepository.getById(folderId);

  if (!folder) {
    return notFoundError("フォルダが見つかりません");
  }

  return NextResponse.json(folder);
});

/**
 * フォルダ更新API
 * PUT /api/folders/[id]
 */
export const PUT = withErrorHandling(async (request: Request, { params }: any) => {
  const { id } = await params;
  const folderId = parseInt(id);

  if (isNaN(folderId)) {
    return validationError("無効なフォルダIDです");
  }

  // ID=1の「すべてのテスト」は編集不可
  if (folderId === 1) {
    return NextResponse.json(
      { error: "このフォルダは編集できません" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { name, parentId = null } = body;

  if (!name) {
    return validationError("フォルダ名が入力されていません");
  }

  const existingFolder = folderRepository.getById(folderId);

  if (!existingFolder) {
    return notFoundError("フォルダが見つかりません");
  }

  // 親フォルダが自分自身でないかチェック
  if (parentId === folderId) {
    return validationError("フォルダを自分自身の親に設定できません");
  }

  // 親フォルダが存在するかチェック
  if (parentId) {
    const parentFolder = folderRepository.getById(parentId);
    if (!parentFolder) {
      return validationError("指定された親フォルダが存在しません");
    }
  }

  // 同名フォルダのチェック
  const nameExists = folderRepository.checkNameExists(name, parentId, folderId);
  if (nameExists) {
    return validationError("同じ親フォルダ内に同名のフォルダが既に存在します");
  }

  const updatedFolder = folderRepository.update(folderId, name, parentId);

  return NextResponse.json(updatedFolder);
});

/**
 * フォルダ部分更新API (#50 アイコン設定など)
 * PATCH /api/folders/[id]
 */
export const PATCH = withErrorHandling(async (request: Request, { params }: any) => {
  const { id } = await params;
  const folderId = parseInt(id);

  if (isNaN(folderId)) {
    return validationError("無効なフォルダIDです");
  }

  const folder = folderRepository.getById(folderId);
  if (!folder) return notFoundError("フォルダが見つかりません");

  const body = await request.json();
  const { icon, name, parentId } = body;

  const updatedFolder = folderRepository.update(
    folderId,
    name ?? folder.name,
    parentId !== undefined ? parentId : folder.parent_id,
    icon !== undefined ? icon : folder.icon
  );

  return NextResponse.json(updatedFolder);
});

/**
 * フォルダ削除API
 * DELETE /api/folders/[id]?force=true (forceパラメータで強制削除)
 */
export const DELETE = withErrorHandling(async (request: Request, { params }: any) => {
  const { id } = await params;
  const folderId = parseInt(id);

  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  if (isNaN(folderId)) {
    return validationError("無効なフォルダIDです");
  }

  // ID=1の「すべてのテスト」は削除不可
  if (folderId === 1) {
    return NextResponse.json(
      { error: "このフォルダは削除できません" },
      { status: 403 }
    );
  }

  const existingFolder = folderRepository.getById(folderId);

  if (!existingFolder) {
    return notFoundError("フォルダが見つかりません");
  }

  // このフォルダに紐づくテストの数を確認
  const testCount = folderRepository.getTestCount(folderId);

  // 強制削除でない場合、テストが存在する場合はエラー
  if (!force && testCount > 0) {
    return NextResponse.json(
      {
        error: `このフォルダには${testCount}件のテストが登録されています。`,
        testCount: testCount,
        canForceDelete: true,
      },
      { status: 409 }
    );
  }

  folderRepository.delete(folderId, force);

  return NextResponse.json({
    success: true,
    forced: force,
    movedToUncategorized: force && testCount > 0,
  });
});
