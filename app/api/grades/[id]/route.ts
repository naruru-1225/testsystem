import { NextResponse } from "next/server";
import { gradeRepository } from "@/lib/repositories/gradeRepository";
import { withErrorHandling, validationError, notFoundError } from "@/lib/api-utils";

/**
 * 学年取得API
 * GET /api/grades/[id]
 */
export const GET = withErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const gradeId = parseInt(id);

  if (isNaN(gradeId)) {
    return validationError("無効な学年IDです");
  }

  const grade = gradeRepository.getById(gradeId);

  if (!grade) {
    return notFoundError("学年が見つかりません");
  }

  return NextResponse.json(grade);
});

/**
 * 学年更新API
 * PUT /api/grades/[id]
 */
export const PUT = withErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const gradeId = parseInt(id);

  if (isNaN(gradeId)) {
    return validationError("無効な学年IDです");
  }

  const body = await request.json();
  const { name, displayOrder } = body;

  if (!name || !name.trim()) {
    return validationError("学年名が入力されていません");
  }

  const existingGrade = gradeRepository.getById(gradeId);
  if (!existingGrade) {
    return notFoundError("学年が見つかりません");
  }

  try {
    const updatedGrade = gradeRepository.update(gradeId, name.trim(), displayOrder ?? 0);
    return NextResponse.json(updatedGrade);
  } catch (error: any) {
    if (error.message?.includes("UNIQUE constraint failed")) {
      return NextResponse.json(
        { error: "この学年名は既に登録されています" },
        { status: 409 }
      );
    }
    throw error;
  }
});

/**
 * 学年削除API
 * DELETE /api/grades/[id]
 */
export const DELETE = withErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const gradeId = parseInt(id);

  if (isNaN(gradeId)) {
    return validationError("無効な学年IDです");
  }

  const existingGrade = gradeRepository.getById(gradeId);
  if (!existingGrade) {
    return notFoundError("学年が見つかりません");
  }

  gradeRepository.delete(gradeId);

  return NextResponse.json({ message: "学年を削除しました" });
});
