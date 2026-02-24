import { NextResponse } from "next/server";
import { testRepository } from "@/lib/repositories/testRepository";
import { withErrorHandling, validationError } from "@/lib/api-utils";
import JSZip from "jszip";
import { readFile } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

/**
 * PDF一括ZIPダウンロードAPI (#106)
 * POST /api/export/zip
 * Body: { testIds: number[] }
 */
export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const { testIds } = body as { testIds: number[] };

  if (!Array.isArray(testIds) || testIds.length === 0) {
    return validationError("テストIDが指定されていません");
  }

  if (testIds.length > 50) {
    return validationError("一括ダウンロードは最大50件までです");
  }

  const zip = new JSZip();
  let addedCount = 0;

  for (const testId of testIds) {
    const test = testRepository.getById(testId);
    if (!test) continue;

    // メインPDFを追加
    if (test.pdf_path) {
      const filePath = path.join(process.cwd(), "public", test.pdf_path);
      if (existsSync(filePath)) {
        const fileBuffer = await readFile(filePath);
        const safeName = `${test.name.replace(/[/\\:*?"<>|]/g, "_")}_${testId}.pdf`;
        zip.file(safeName, fileBuffer);
        addedCount++;
      }
    }

    // 添付ファイルを追加
    const attachments = testRepository.getAttachments(testId);
    for (const att of attachments) {
      const filePath = path.join(process.cwd(), "public", att.file_path);
      if (existsSync(filePath)) {
        const fileBuffer = await readFile(filePath);
        const ext = path.extname(att.file_name) || ".pdf";
        const safeName = `${test.name.replace(/[/\\:*?"<>|]/g, "_")}_${testId}_${att.id}${ext}`;
        zip.file(safeName, fileBuffer);
        addedCount++;
      }
    }
  }

  if (addedCount === 0) {
    return validationError("ダウンロード可能なPDFが見つかりません");
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="tests_${new Date().toISOString().slice(0, 10)}.zip"`,
      "Content-Length": String(zipBuffer.byteLength),
    },
  });
});
