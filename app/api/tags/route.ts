import { NextResponse } from "next/server";
import db from "@/lib/database";
import type { Tag } from "@/types/database";

/**
 * タグ一覧取得API
 * GET /api/tags
 */
export async function GET() {
  try {
    const stmt = db.prepare("SELECT * FROM tags ORDER BY id ASC");
    const tags = stmt.all() as Tag[];

    return NextResponse.json(tags);
  } catch (error) {
    console.error("タグ一覧取得エラー:", error);
    return NextResponse.json(
      { error: "タグ一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * タグ新規作成API
 * POST /api/tags
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, color = '#3B82F6' } = body;

    if (!name) {
      return NextResponse.json(
        { error: "タグ名が入力されていません" },
        { status: 400 }
      );
    }

    const insertTag = db.prepare("INSERT INTO tags (name, color) VALUES (?, ?)");
    const result = insertTag.run(name, color);

    const newTag = db
      .prepare("SELECT * FROM tags WHERE id = ?")
      .get(result.lastInsertRowid) as Tag;

    return NextResponse.json(newTag, { status: 201 });
  } catch (error: any) {
    console.error("タグ作成エラー:", error);

    if (error.message?.includes("UNIQUE constraint failed")) {
      return NextResponse.json(
        { error: "同じ名前のタグが既に存在します" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "タグの作成に失敗しました" },
      { status: 500 }
    );
  }
}
