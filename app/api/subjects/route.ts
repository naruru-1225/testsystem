import { NextResponse } from "next/server";
import { subjectRepository } from "@/lib/repositories/subjectRepository";
import { withErrorHandling, validationError } from "@/lib/api-utils";

/**
 * 科目一覧取得API
 * GET /api/subjects
 * GET /api/subjects?withCounts=true  (#69)
 */
export const GET = withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const withCounts = searchParams.get("withCounts") === "true";
  const subjects = withCounts
    ? subjectRepository.getAllWithUsageCounts()
    : subjectRepository.getAll();
  return NextResponse.json(subjects);
});

/**
 * 科目作成API
 * POST /api/subjects
 */
export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const { name, displayOrder = 0 } = body;

  if (!name || !name.trim()) {
    return validationError("科目名が入力されていません");
  }

  try {
    const newSubject = subjectRepository.create(name.trim(), displayOrder);
    return NextResponse.json(newSubject, { status: 201 });
  } catch (error: any) {
    if (error.message?.includes("UNIQUE constraint failed")) {
      return validationError("同名の科目が既に存在します");
    }
    throw error;
  }
});


