import { NextResponse } from "next/server";
import { subjectRepository } from "@/lib/repositories/subjectRepository";
import { withErrorHandling, validationError, notFoundError } from "@/lib/api-utils";

/**
 * 科目取得API
 * GET /api/subjects/[id]
 */
export const GET = withErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const subjectId = parseInt(id);

  if (isNaN(subjectId)) {
    return validationError("無効な科目IDです");
  }

  const subject = subjectRepository.getById(subjectId);

  if (!subject) {
    return notFoundError("科目が見つかりません");
  }

  return NextResponse.json(subject);
});

/**
 * 科目更新API
 * PUT /api/subjects/[id]
 */
export const PUT = withErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const subjectId = parseInt(id);

  if (isNaN(subjectId)) {
    return validationError("無効な科目IDです");
  }

  const body = await request.json();
  const { name, displayOrder } = body;

  if (!name || !name.trim()) {
    return validationError("科目名が入力されていません");
  }

  const existingSubject = subjectRepository.getById(subjectId);
  if (!existingSubject) {
    return notFoundError("科目が見つかりません");
  }

  try {
    const updatedSubject = subjectRepository.update(subjectId, name.trim(), displayOrder ?? 0);
    return NextResponse.json(updatedSubject);
  } catch (error: any) {
    if (error.message?.includes("UNIQUE constraint failed")) {
      return NextResponse.json(
        { error: "この科目名は既に登録されています" },
        { status: 409 }
      );
    }
    throw error;
  }
});

/**
 * 科目削除API
 * DELETE /api/subjects/[id]
 */
export const DELETE = withErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const subjectId = parseInt(id);

  if (isNaN(subjectId)) {
    return validationError("無効な科目IDです");
  }

  const existingSubject = subjectRepository.getById(subjectId);
  if (!existingSubject) {
    return notFoundError("科目が見つかりません");
  }

  subjectRepository.delete(subjectId);

  return NextResponse.json({ message: "科目を削除しました" });
});
