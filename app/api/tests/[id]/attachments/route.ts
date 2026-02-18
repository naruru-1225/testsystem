import { NextResponse } from "next/server";
import { testRepository } from "@/lib/repositories/testRepository";
import { fileService } from "@/lib/services/fileService";
import {
  withErrorHandling,
  validationError,
  notFoundError,
} from "@/lib/api-utils";

/**
 * テスト添付ファイル一覧取得API
 * GET /api/tests/[id]/attachments
 */
export const GET = withErrorHandling(async (request: Request, { params }: any) => {
  const { id } = await params;
  const testId = parseInt(id);

  if (isNaN(testId)) {
    return validationError("無効なテストIDです");
  }

  const attachments = testRepository.getAttachments(testId);

  return NextResponse.json({ attachments });
});

/**
 * テスト添付ファイル削除API
 * DELETE /api/tests/[id]/attachments?attachmentId=xxx
 */
export const DELETE = withErrorHandling(async (request: Request, { params }: any) => {
  const { id } = await params;
  const testId = parseInt(id);
  const url = new URL(request.url);
  const attachmentIdParam = url.searchParams.get("attachmentId");

  if (isNaN(testId)) {
    return validationError("無効なテストIDです");
  }

  if (!attachmentIdParam) {
    return validationError("添付ファイルIDが指定されていません");
  }

  const attachmentId = parseInt(attachmentIdParam);
  if (isNaN(attachmentId)) {
    return validationError("無効な添付ファイルIDです");
  }

  // 添付ファイル情報を取得
  const attachment = testRepository.getAttachment(attachmentId);

  if (!attachment) {
    return notFoundError("添付ファイルが見つかりません");
  }

  if (attachment.test_id !== testId) {
    return validationError("このテストの添付ファイルではありません");
  }

  // 物理ファイルを削除
  fileService.deleteFile(attachment.file_path);

  // データベースから削除
  testRepository.deleteAttachment(attachmentId);

  return NextResponse.json({
    success: true,
    message: "添付ファイルを削除しました",
  });
});

/**
 * テスト添付ファイル名変更API
 * PATCH /api/tests/[id]/attachments
 */
export const PATCH = withErrorHandling(async (request: Request, { params }: any) => {
  const { id } = await params;
  const testId = parseInt(id);
  const body = await request.json();
  const { attachmentId, fileName } = body;

  if (isNaN(testId)) {
    return validationError("無効なテストIDです");
  }

  if (!attachmentId || !fileName || !fileName.trim()) {
    return validationError("添付ファイルIDとファイル名を指定してください");
  }

  const attachment = testRepository.getAttachment(parseInt(attachmentId));

  if (!attachment) {
    return notFoundError("添付ファイルが見つかりません");
  }

  if (attachment.test_id !== testId) {
    return validationError("このテストの添付ファイルではありません");
  }

  testRepository.renameAttachment(parseInt(attachmentId), fileName.trim());

  return NextResponse.json({
    success: true,
    message: "ファイル名を変更しました",
  });
});
