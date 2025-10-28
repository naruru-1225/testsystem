import { NextResponse } from "next/server";
import db from "@/lib/database";
import type { Folder } from "@/types/database";

/**
 * フォルダ取得API
 * GET /api/folders/[id]
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const folderId = parseInt(id);

    if (isNaN(folderId)) {
      return NextResponse.json(
        { error: "無効なフォルダIDです" },
        { status: 400 }
      );
    }

    const folder = db
      .prepare("SELECT * FROM folders WHERE id = ?")
      .get(folderId) as Folder;

    if (!folder) {
      return NextResponse.json(
        { error: "フォルダが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(folder);
  } catch (error) {
    console.error("フォルダ取得エラー:", error);
    return NextResponse.json(
      { error: "フォルダの取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * フォルダ更新API
 * PUT /api/folders/[id]
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const folderId = parseInt(id);

    if (isNaN(folderId)) {
      return NextResponse.json(
        { error: "無効なフォルダIDです" },
        { status: 400 }
      );
    }

    // ID=1の「すべてのテスト」は編集不可
    if (folderId === 1) {
      return NextResponse.json(
        { error: "このフォルダは編集できません" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, parentId = null } = body;

    if (!name) {
      return NextResponse.json(
        { error: "フォルダ名が入力されていません" },
        { status: 400 }
      );
    }

    const existingFolder = db
      .prepare("SELECT id FROM folders WHERE id = ?")
      .get(folderId);

    if (!existingFolder) {
      return NextResponse.json(
        { error: "フォルダが見つかりません" },
        { status: 404 }
      );
    }

    // 親フォルダが自分自身でないかチェック
    if (parentId === folderId) {
      return NextResponse.json(
        { error: "フォルダを自分自身の親に設定できません" },
        { status: 400 }
      );
    }

    db.prepare("UPDATE folders SET name = ?, parent_id = ? WHERE id = ?").run(name, parentId, folderId);

    const updatedFolder = db
      .prepare("SELECT * FROM folders WHERE id = ?")
      .get(folderId) as Folder;

    return NextResponse.json(updatedFolder);
  } catch (error: any) {
    console.error("フォルダ更新エラー:", error);

    if (error.message?.includes("UNIQUE constraint failed")) {
      return NextResponse.json(
        { error: "同じ名前のフォルダが既に存在します" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "フォルダの更新に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * フォルダ削除API
 * DELETE /api/folders/[id]
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const folderId = parseInt(id);

    if (isNaN(folderId)) {
      return NextResponse.json(
        { error: "無効なフォルダIDです" },
        { status: 400 }
      );
    }

    // ID=1の「すべてのテスト」は削除不可
    if (folderId === 1) {
      return NextResponse.json(
        { error: "このフォルダは削除できません" },
        { status: 403 }
      );
    }

    const existingFolder = db
      .prepare("SELECT id FROM folders WHERE id = ?")
      .get(folderId);

    if (!existingFolder) {
      return NextResponse.json(
        { error: "フォルダが見つかりません" },
        { status: 404 }
      );
    }

    // このフォルダに紐づくテストの数を確認
    const testCount = db
      .prepare("SELECT COUNT(*) as count FROM tests WHERE folder_id = ?")
      .get(folderId) as { count: number };

    if (testCount.count > 0) {
      return NextResponse.json(
        { error: `このフォルダには${testCount.count}件のテストが登録されています。先にテストを削除または移動してください。` },
        { status: 409 }
      );
    }

    db.prepare("DELETE FROM folders WHERE id = ?").run(folderId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("フォルダ削除エラー:", error);
    return NextResponse.json(
      { error: "フォルダの削除に失敗しました" },
      { status: 500 }
    );
  }
}
