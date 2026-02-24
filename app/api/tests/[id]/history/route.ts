import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/database";

interface AuditLogEntry {
  id: number;
  action: string;
  target_type: string;
  target_id: number;
  target_name: string | null;
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

    const history = db
      .prepare(`
        SELECT id, action, target_type, target_id, target_name, device_hint, created_at
        FROM audit_log
        WHERE target_type = 'test' AND target_id = ?
        ORDER BY created_at DESC
        LIMIT 100
      `)
      .all(testId) as AuditLogEntry[];

    return NextResponse.json({ history });
  } catch (error) {
    console.error("GET history error:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
