import { NextResponse } from "next/server";
import { withErrorHandling, validationError } from "@/lib/api-utils";
import { getDatabase } from "@/lib/database";

/**
 * 科目の代替先置き換えAPI (#70)
 * POST /api/subjects/replace
 * { fromId: number, toId: number }
 * fromId の科目を使用しているテスト全てを toId に変更
 */
export const POST = withErrorHandling(
  async (request: Request) => {
    const { fromId, toId } = await request.json();

    if (!fromId || !toId) {
      return validationError("fromId と toId が必要です");
    }

    const db = getDatabase();

    // fromId の科目名を取得
    const fromSubject = db.prepare("SELECT name FROM subjects WHERE id = ?").get(fromId) as { name: string } | undefined;
    const toSubject = db.prepare("SELECT name FROM subjects WHERE id = ?").get(toId) as { name: string } | undefined;

    if (!fromSubject) return validationError("置き換え元の科目が見つかりません");
    if (!toSubject) return validationError("置き換え先の科目が見つかりません");

    // テストの subject を一括更新
    const result = db
      .prepare("UPDATE tests SET subject = ?, updated_at = datetime('now') WHERE subject = ?")
      .run(toSubject.name, fromSubject.name);

    return NextResponse.json({
      message: `${result.changes}件のテストを「${toSubject.name}」に移行しました`,
      changes: result.changes,
    });
  }
);
