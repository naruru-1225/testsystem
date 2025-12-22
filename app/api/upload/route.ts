import { NextResponse } from "next/server";
import { fileService } from "@/lib/services/fileService";
import { testRepository } from "@/lib/repositories/testRepository";
import { withErrorHandling, validationError } from "@/lib/api-utils";

/**
 * PDFファイルアップロードAPI
 * POST /api/upload
 * クエリパラメータ: testId (オプション: 既存テストへの添付用)
 */
export const POST = withErrorHandling(async (request: Request) => {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  const testIdParam = formData.get("testId") as string | null;

  if (!file) {
    return validationError("ファイルが選択されていません");
  }

  // ファイル拡張子を取得
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "";

  console.log("アップロードファイル情報:", {
    name: file.name,
    type: file.type,
    size: file.size,
    extension: fileExt,
  });

  // 許可する拡張子
  const allowedExtensions = ["pdf", "heic", "heif", "jpg", "jpeg", "png"];

  // 許可するファイルタイプ（PDFと画像のみ）
  const allowedTypes = [
    "application/pdf",
    "image/heic",
    "image/heif",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/x-heic", // 一部ブラウザのHEIC MIMEタイプ
    "application/octet-stream", // 不明なバイナリファイル
    "", // 空のMIMEタイプ
  ];

  // 拡張子が許可リストにあればOK（HEICファイル対応）
  const isValidExtension = allowedExtensions.includes(fileExt);
  // MIMEタイプが許可リストにあればOK
  const isValidMimeType = allowedTypes.includes(file.type);

  // 拡張子が有効な場合は、MIMEタイプに関係なくアップロード許可
  // (HEICファイルは拡張子で判定)
  if (!isValidExtension && !isValidMimeType) {
    console.log("❌ ファイルタイプ拒否:", {
      fileName: file.name,
      type: file.type,
      typeLength: file.type.length,
      extension: fileExt,
      isValidExtension,
      isValidMimeType,
    });
    return validationError(
      "PDF、HEIC、JPG、PNGファイルのみアップロード可能です"
    );
  }

  console.log("✅ ファイルタイプ承認:", {
    fileName: file.name,
    type: file.type,
    extension: fileExt,
    isValidExtension,
    isValidMimeType,
  });

  // ファイルサイズチェック(10MB制限)
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_FILE_SIZE) {
    return validationError("ファイルサイズは10MB以下にしてください");
  }

  const testId = testIdParam ? parseInt(testIdParam) : undefined;

  // testIdが指定されている場合、添付ファイル数をチェック
  if (testId) {
    const count = testRepository.getAttachmentCount(testId);
    if (count >= 5) {
      return validationError("添付ファイルは最大5つまでです");
    }
  }

  // ファイルを保存
  const savedFile = await fileService.saveFile(file, testId);

  let attachmentId: number | undefined;

  // データベースに記録 (testIdがある場合)
  if (testId) {
    attachmentId = testRepository.addAttachment(
      testId,
      savedFile.fileName,
      savedFile.path,
      savedFile.mimeType,
      savedFile.size
    );
  }

  return NextResponse.json({
    success: true,
    path: savedFile.path,
    fileName: savedFile.fileName,
    size: savedFile.size,
    mimeType: savedFile.mimeType,
    attachmentId: attachmentId,
    converted: savedFile.converted,
  });
});
