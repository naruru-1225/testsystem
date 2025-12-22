import { NextResponse } from "next/server";
import { gradeRepository } from "@/lib/repositories/gradeRepository";
import { withErrorHandling, validationError } from "@/lib/api-utils";

/**
 * 学年一覧取得API
 * GET /api/grades
 */
export const GET = withErrorHandling(async () => {
  const grades = gradeRepository.getAll();
  return NextResponse.json(grades);
});

/**
 * 学年作成API
 * POST /api/grades
 */
export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const { name, displayOrder = 0 } = body;

  if (!name || !name.trim()) {
    return validationError("学年名が入力されていません");
  }

  try {
    const newGrade = gradeRepository.create(name.trim(), displayOrder);
    return NextResponse.json(newGrade, { status: 201 });
  } catch (error: any) {
    if (error.message?.includes("UNIQUE constraint failed")) {
      return validationError("同名の学年が既に存在します");
    }
    throw error;
  }
});

