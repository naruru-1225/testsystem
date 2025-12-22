import { NextResponse } from "next/server";
import { tagRepository } from "@/lib/repositories/tagRepository";
import { withErrorHandling, validationError } from "@/lib/api-utils";

/**
 * タグ一覧取得API
 * GET /api/tags
 */
export const GET = withErrorHandling(async () => {
  const tags = tagRepository.getAll();
  return NextResponse.json(tags);
});

/**
 * タグ新規作成API
 * POST /api/tags
 */
export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const { name, color = "#3B82F6" } = body;

  if (!name) {
    return validationError("タグ名が入力されていません");
  }

  try {
    const newTag = tagRepository.create(name, color);
    return NextResponse.json(newTag, { status: 201 });
  } catch (error: any) {
    if (error.message?.includes("UNIQUE constraint failed")) {
      return validationError("同名のタグが既に存在します");
    }
    throw error;
  }
});

