import { NextResponse } from "next/server";
import { emailInboxRepository } from "@/lib/repositories/emailInboxRepository";
import { withErrorHandling } from "@/lib/api-utils";

/**
 * ステータス更新 PATCH /api/inbox/[id]
 * body: { status: "pending" | "assigned" | "error", errorMessage?: string }
 */
export const PATCH = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const itemId = parseInt(id);
    const body = await request.json();
    const { status, errorMessage } = body;

    if (!status) {
      return NextResponse.json({ error: "status が必要です" }, { status: 400 });
    }

    emailInboxRepository.updateStatus(itemId, status, errorMessage);
    return NextResponse.json({ success: true });
  }
);

/**
 * 削除 DELETE /api/inbox/[id]
 */
export const DELETE = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    emailInboxRepository.delete(parseInt(id));
    return NextResponse.json({ success: true });
  }
);
