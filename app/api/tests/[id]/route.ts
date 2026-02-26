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
      lastKnownUpdatedAt, // #105 競合検出
    } = body;

    // #105 競合検出: クライアントが知っている updated_at と現在の値を比較
    if (lastKnownUpdatedAt) {
      const current = testRepository.getById(testId);
      if (current && current.updated_at) {
        const currentTs = new Date(current.updated_at).getTime();
        const knownTs = new Date(lastKnownUpdatedAt).getTime();
        if (Math.abs(currentTs - knownTs) > 1000) { // 1秒以上差があれば競合
          return new NextResponse(
            JSON.stringify({ error: "別のユーザーによって更新されています。ページを更新してください。" }),
            { status: 409, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    }

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

/**
 * テスト部分更新API (#42 フォルダ移動など)
 * PATCH /api/tests/[id]
 */
export const PATCH = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const testId = parseInt(id);

    if (isNaN(testId)) {
      return validationError("無効なテストIDです");
    }

    const existing = testRepository.getById(testId);
    if (!existing) {
      return notFoundError("テストが見つかりません");
    }

    const body = await request.json();

    // folder_id の更新
    if ("folder_id" in body) {
      const folderId = body.folder_id != null ? parseInt(String(body.folder_id)) : null;
      if (folderId != null) {
        const folder = folderRepository.getById(folderId);
        if (!folder) {
          return validationError("指定されたフォルダが見つかりません");
        }
      }
      testRepository.updateFolder(testId, folderId);
      await auditService.log("update", "test", testId, existing.name, request);
      return NextResponse.json({ message: "フォルダを更新しました" });
    }

    return validationError("更新できるフィールドが指定されていません");
  }
);
