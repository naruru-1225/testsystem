import { NextResponse } from "next/server";
import { gradeRepository } from "@/lib/repositories/gradeRepository";
import { withErrorHandling, validationError } from "@/lib/api-utils";

/**
 * 学年一覧取得API
 * GET /api/grades
 * GET /api/grades?withCounts=true  (#69)
 */
export const GET = withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const withCounts = searchParams.get("withCounts") === "true";
  const grades = withCounts
    ? gradeRepository.getAllWithUsageCounts()
    : gradeRepository.getAll();
  return NextResponse.json(grades, {
    headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
  });
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


