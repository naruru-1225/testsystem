import { NextResponse } from "next/server";
import { emailInboxRepository } from "@/lib/repositories/emailInboxRepository";
import { withErrorHandling } from "@/lib/api-utils";

/**
 * 受信トレイ一覧取得 GET /api/inbox
 */
export const GET = withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let items;
  if (status === "pending") {
    items = emailInboxRepository.getPending();
  } else {
    items = emailInboxRepository.getAll();
  }

  const pendingCount = emailInboxRepository.getPendingCount();
  return NextResponse.json({ items, pendingCount });
});

/**
 * 受信トレイ削除 DELETE /api/inbox
 * body: { ids: number[] }
 */
export const DELETE = withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const ids: number[] = body.ids ?? [];

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids が必要です" }, { status: 400 });
  }

  emailInboxRepository.deleteMany(ids);
  return NextResponse.json({ success: true, deleted: ids.length });
});
