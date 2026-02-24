import { NextResponse } from "next/server";
import { unlink, rm } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { testRepository } from "@/lib/repositories/testRepository";
import { folderRepository } from "@/lib/repositories/folderRepository";
import { withErrorHandling, validationError, notFoundError } from "@/lib/api-utils";
import { auditService } from "@/lib/services/auditService";
import { sanitizeText } from "@/lib/utils/sanitize";

/**
 * テスト個別取得API
 * GET /api/tests/[id]
 */
export const GET = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const testId = parseInt(id);

    if (isNaN(testId)) {
      return validationError("無効なテストIDです");
    }

    const test = testRepository.getById(testId);
    if (!test) {
      return notFoundError("テストが見つかりません");
    }

    return NextResponse.json(test);
  }
);

/**
 * テスト更新API
 * PUT /api/tests/[id]
 */
export const PUT = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const testId = parseInt(id);

    if (isNaN(testId)) {
      return validationError("無効なテストIDです");
    }

    const body = await request.json();
    let {
      name,
      subject,
      grade,
      folderIds = [],
      tagIds,
      pdfPath,
      description,
      totalQuestions,
      totalScore,
      attachmentPaths,
      attachmentFileNames,
    } = body;

    // 入力値サニタイズ (#101)
    name = sanitizeText(name);
    subject = sanitizeText(subject);
    grade = sanitizeText(grade);
    if (description) description = sanitizeText(description);

    // フォルダ処理ロジック (POSTと同様)
    const uncategorizedFolder = folderRepository.getUncategorized();
    const uncategorizedId = uncategorizedFolder?.id || 2;

    if (folderIds.length === 0) {
      if (uncategorizedFolder) {
        folderIds = [uncategorizedId];
      }
    } else if (uncategorizedFolder) {
      folderIds = folderIds.filter((fid: number) => fid !== uncategorizedId);
      if (folderIds.length === 0) {
        folderIds = [uncategorizedId];
      }
    }

    // 添付ファイルの整形
    let attachments = undefined;
    if (attachmentPaths) {
      attachments = attachmentPaths.map((path: string, index: number) => ({
        filePath: path,
        fileName:
          (attachmentFileNames && attachmentFileNames[index]) ||
          `attachment_${index + 1}.pdf`,
      }));
    }

    const updatedTest = testRepository.update(testId, {
      name,
      subject,
      grade,
      folderId: folderIds[0],
      description,
      pdfPath,
      tagIds,
      folderIds,
      totalQuestions,
      totalScore,
      attachments,
    });

    if (!updatedTest) {
      return notFoundError("テストが見つかりません");
    }

    await auditService.log("update", "test", testId, name, request);

    return NextResponse.json(updatedTest);
  }
);

/**
 * テスト削除API
 * DELETE /api/tests/[id]
 */
export const DELETE = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const testId = parseInt(id);

    if (isNaN(testId)) {
      return validationError("無効なテストIDです");
    }

    const existingTest = testRepository.getById(testId);
    if (!existingTest) {
      return notFoundError("テストが見つかりません");
    }

    // 添付ファイルの取得
    const attachments = testRepository.getAttachments(testId);

    // 物理ファイルとフォルダの削除
    if (attachments.length > 0) {
      // 各ファイルを削除
      for (const attachment of attachments) {
        const filePath = path.join(
          process.cwd(),
          "public",
          attachment.file_path
        );
        if (existsSync(filePath)) {
          await unlink(filePath);
        }
      }

      // テスト別フォルダの削除
      const testFolderPath = path.join(
        process.cwd(),
        "public",
        "uploads",
        "pdfs",
        `test_${testId}`
      );
      if (existsSync(testFolderPath)) {
        await rm(testFolderPath, { recursive: true, force: true });
      }
    }

    // テストの削除
    await auditService.log("delete", "test", testId, existingTest.name, request);
    testRepository.delete(testId);

    return NextResponse.json({
      message: "テストを削除しました",
      deletedTest: existingTest,
    });
  }
);
