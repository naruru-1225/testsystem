import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/database";

interface RelatedTest {
  id: number;
  name: string;
  subject: string | null;
  grade: string | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const testId = parseInt(id);
    if (isNaN(testId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const related = db.prepare(`
      SELECT t.id, t.name, t.subject, t.grade
      FROM related_tests rt
      JOIN tests t ON t.id = rt.related_test_id
      WHERE rt.test_id = ?
      UNION
      SELECT t.id, t.name, t.subject, t.grade
      FROM related_tests rt
      JOIN tests t ON t.id = rt.test_id
      WHERE rt.related_test_id = ?
    `).all(testId, testId) as RelatedTest[];

    return NextResponse.json({ related });
  } catch (error) {
    console.error("GET related error:", error);
    return NextResponse.json({ error: "Failed to fetch related tests" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const testId = parseInt(id);
    const { relatedTestId } = await request.json();

    if (isNaN(testId) || !relatedTestId || testId === relatedTestId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // 双方向で INSERT OR IGNORE
    db.prepare("INSERT OR IGNORE INTO related_tests (test_id, related_test_id) VALUES (?, ?)")
      .run(testId, relatedTestId);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("POST related error:", error);
    return NextResponse.json({ error: "Failed to add relation" }, { status: 500 });
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
    const relatedTestId = parseInt(searchParams.get("relatedTestId") || "");

    if (isNaN(relatedTestId)) {
      return NextResponse.json({ error: "relatedTestId is required" }, { status: 400 });
    }

    db.prepare("DELETE FROM related_tests WHERE (test_id = ? AND related_test_id = ?) OR (test_id = ? AND related_test_id = ?)")
      .run(testId, relatedTestId, relatedTestId, testId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE related error:", error);
    return NextResponse.json({ error: "Failed to remove relation" }, { status: 500 });
  }
}
