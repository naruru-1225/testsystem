import { NextResponse } from "next/server";
import { tagRepository } from "@/lib/repositories/tagRepository";
import { withErrorHandling, validationError, notFoundError } from "@/lib/api-utils";

/**
 * タグ取得API
 * GET /api/tags/[id]
 */
export const GET = withErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const tagId = parseInt(id);

  if (isNaN(tagId)) {
    return validationError("無効なタグIDです");
  }

  const tag = tagRepository.getById(tagId);

  if (!tag) {
    return notFoundError("タグが見つかりません");
  }

  return NextResponse.json(tag);
});

/**
 * タグ更新API
 * PUT /api/tags/[id]
 */
export const PUT = withErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const tagId = parseInt(id);

  if (isNaN(tagId)) {
    return validationError("無効なタグIDです");
  }

  const body = await request.json();
  const { name, color } = body;

  if (!name || !color) {
    return validationError("タグ名と色が必要です");
  }

  const existingTag = tagRepository.getById(tagId);
  if (!existingTag) {
    return notFoundError("タグが見つかりません");
  }

  try {
    const updatedTag = tagRepository.update(tagId, name, color);
    return NextResponse.json(updatedTag);
  } catch (error: any) {
    if (error.message?.includes("UNIQUE constraint failed")) {
      return NextResponse.json(
        { error: "同じ名前のタグが既に存在します" },
        { status: 409 }
      );
    }
    throw error;
  }
});

/**
 * タグ削除API
 * DELETE /api/tags/[id]
 */
export const DELETE = withErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const tagId = parseInt(id);

  if (isNaN(tagId)) {
    return validationError("無効なタグIDです");
  }

  const existingTag = tagRepository.getById(tagId);
  if (!existingTag) {
    return notFoundError("タグが見つかりません");
  }

  tagRepository.delete(tagId);

  return NextResponse.json({ message: "タグを削除しました" });
});
