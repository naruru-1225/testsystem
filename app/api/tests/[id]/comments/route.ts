import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/database";

interface TestComment {
  id: number;
  test_id: number;
  content: string;
  device_hint: string | null;
  created_at: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const testId = parseInt(id);
    if (isNaN(testId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const comments = db
      .prepare("SELECT * FROM test_comments WHERE test_id = ? ORDER BY created_at ASC")
      .all(testId) as TestComment[];

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("GET comments error:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const testId = parseInt(id);
    if (isNaN(testId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const { content } = body;
    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const ua = request.headers.get("user-agent") || "";
    const deviceHint = ua.includes("iPad") || ua.includes("Android")
      ? "モバイル"
      : ua.includes("Windows")
      ? "Windows"
      : ua.includes("Mac")
      ? "Mac"
      : "その他";

    const result = db
      .prepare("INSERT INTO test_comments (test_id, content, device_hint) VALUES (?, ?, ?)")
      .run(testId, content.trim(), deviceHint);

    const comment = db
      .prepare("SELECT * FROM test_comments WHERE id = ?")
      .get(result.lastInsertRowid) as TestComment;

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("POST comment error:", error);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const testId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const commentId = parseInt(searchParams.get("commentId") || "");

    if (isNaN(commentId)) {
      return NextResponse.json({ error: "commentId is required" }, { status: 400 });
    }

    const result = db
      .prepare("DELETE FROM test_comments WHERE id = ? AND test_id = ?")
      .run(commentId, testId);

    if (result.changes === 0) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE comment error:", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
