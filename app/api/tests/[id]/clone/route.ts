import { NextResponse } from "next/server";
import { testRepository } from "@/lib/repositories/testRepository";
import { withErrorHandling } from "@/lib/api-utils";

/**
 * テスト複製API
 * POST /api/tests/[id]/clone
 */
export const POST = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const testId = parseInt(id);
    if (isNaN(testId)) {
      return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
    }

    const original = testRepository.getById(testId);
    if (!original) {
      return NextResponse.json({ error: "テストが見つかりません" }, { status: 404 });
    }

    // コピーを作成
    const cloned = testRepository.create({
      name: `${original.name}（コピー）`,
      subject: original.subject,
      grade: original.grade,
      folderId: original.folder_id,
      description: original.description ?? undefined,
      pdfPath: original.pdf_path ?? undefined,
      tagIds: original.tags.map((t) => t.id),
      totalQuestions: original.total_questions ?? undefined,
      totalScore: original.total_score ?? undefined,
      // 添付ファイルはパスを共有（ファイル自体はコピーしない）
      attachments: [], // 添付ファイルは複製しない（ファイルサイズ節約)
    });

    return NextResponse.json(cloned, { status: 201 });
  }
);
