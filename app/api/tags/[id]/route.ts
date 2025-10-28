import { NextResponse } from "next/server";
import db from "@/lib/database";
import type { Tag } from "@/types/database";

/**
 * タグ取得API
 * GET /api/tags/[id]
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tagId = parseInt(id);

    if (isNaN(tagId)) {
      return NextResponse.json(
        { error: "無効なタグIDです" },
        { status: 400 }
      );
    }

    const tag = db
      .prepare("SELECT * FROM tags WHERE id = ?")
      .get(tagId) as Tag;

    if (!tag) {
      return NextResponse.json(
        { error: "タグが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(tag);
  } catch (error) {
    console.error("タグ取得エラー:", error);
    return NextResponse.json(
      { error: "タグの取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * タグ更新API
 * PUT /api/tags/[id]
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tagId = parseInt(id);

    if (isNaN(tagId)) {
      return NextResponse.json(
        { error: "無効なタグIDです" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, color } = body;

    if (!name || !color) {
      return NextResponse.json(
        { error: "タグ名と色が必要です" },
        { status: 400 }
      );
    }

    const existingTag = db
      .prepare("SELECT id FROM tags WHERE id = ?")
      .get(tagId);

    if (!existingTag) {
      return NextResponse.json(
        { error: "タグが見つかりません" },
        { status: 404 }
      );
    }

    db.prepare("UPDATE tags SET name = ?, color = ? WHERE id = ?").run(
      name,
      color,
      tagId
    );

    const updatedTag = db
      .prepare("SELECT * FROM tags WHERE id = ?")
      .get(tagId) as Tag;

    return NextResponse.json(updatedTag);
  } catch (error: any) {
    console.error("タグ更新エラー:", error);

    if (error.message?.includes("UNIQUE constraint failed")) {
      return NextResponse.json(
        { error: "同じ名前のタグが既に存在します" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "タグの更新に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * タグ削除API
 * DELETE /api/tags/[id]
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tagId = parseInt(id);

    if (isNaN(tagId)) {
      return NextResponse.json(
        { error: "無効なタグIDです" },
        { status: 400 }
      );
    }

    const existingTag = db
      .prepare("SELECT id FROM tags WHERE id = ?")
      .get(tagId);

    if (!existingTag) {
      return NextResponse.json(
        { error: "タグが見つかりません" },
        { status: 404 }
      );
    }

    // このタグを使用しているテストの数を確認
    const testCount = db
      .prepare("SELECT COUNT(*) as count FROM test_tags WHERE tag_id = ?")
      .get(tagId) as { count: number };

    if (testCount.count > 0) {
      return NextResponse.json(
        {
          error: `このタグは${testCount.count}件のテストで使用されています。先にテストから削除してください。`,
        },
        { status: 409 }
      );
    }

    db.prepare("DELETE FROM tags WHERE id = ?").run(tagId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("タグ削除エラー:", error);
    return NextResponse.json(
      { error: "タグの削除に失敗しました" },
      { status: 500 }
    );
  }
}
