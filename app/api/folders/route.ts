import { NextResponse } from "next/server";
import db from "@/lib/database";
import type { Folder } from "@/types/database";

/**
 * フォルダ一覧取得API
 * GET /api/folders
 */
export async function GET() {
  try {
    const stmt = db.prepare("SELECT * FROM folders ORDER BY id ASC");
    const folders = stmt.all() as Folder[];

    return NextResponse.json(folders);
  } catch (error) {
    console.error("フォルダ一覧取得エラー:", error);
    return NextResponse.json(
      { error: "フォルダ一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * フォルダ新規作成API
 * POST /api/folders
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, parentId = null } = body;

    if (!name) {
      return NextResponse.json(
        { error: "フォルダ名が入力されていません" },
        { status: 400 }
      );
    }

    const insertFolder = db.prepare("INSERT INTO folders (name, parent_id) VALUES (?, ?)");
    const result = insertFolder.run(name, parentId);

    const newFolder = db
      .prepare("SELECT * FROM folders WHERE id = ?")
      .get(result.lastInsertRowid) as Folder;

    return NextResponse.json(newFolder, { status: 201 });
  } catch (error: any) {
    console.error("フォルダ作成エラー:", error);

    // ユニーク制約違反
    if (error.message?.includes("UNIQUE constraint failed")) {
      return NextResponse.json(
        { error: "同じ名前のフォルダが既に存在します" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "フォルダの作成に失敗しました" },
      { status: 500 }
    );
  }
}
