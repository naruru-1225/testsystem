import { NextResponse } from "next/server";
import { withErrorHandling, validationError } from "@/lib/api-utils";
import { getDatabase } from "@/lib/database";

/**
 * 学年の代替先置き換えAPI (#70)
 * POST /api/grades/replace
 * { fromId: number, toId: number }
 * fromId の学年を使用しているテスト全てを toId に変更
 */
export const POST = withErrorHandling(
  async (request: Request) => {
    const { fromId, toId } = await request.json();

    if (!fromId || !toId) {
      return validationError("fromId と toId が必要です");
    }

    const db = getDatabase();

    // fromId の学年名を取得
    const fromGrade = db.prepare("SELECT name FROM grades WHERE id = ?").get(fromId) as { name: string } | undefined;
    const toGrade = db.prepare("SELECT name FROM grades WHERE id = ?").get(toId) as { name: string } | undefined;

    if (!fromGrade) return validationError("置き換え元の学年が見つかりません");
    if (!toGrade) return validationError("置き換え先の学年が見つかりません");

    // テストの grade を一括更新
    const result = db
      .prepare("UPDATE tests SET grade = ?, updated_at = datetime('now') WHERE grade = ?")
      .run(toGrade.name, fromGrade.name);

    return NextResponse.json({
      message: `${result.changes}件のテストを「${toGrade.name}」に移行しました`,
      changes: result.changes,
    });
  }
);
