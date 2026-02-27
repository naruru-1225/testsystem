import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import db from "@/lib/database";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const testId = parseInt(id);
    if (isNaN(testId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const test = db.prepare("SELECT id, name FROM tests WHERE id = ?").get(testId) as { id: number; name: string } | undefined;
    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    // URLを構築
    const origin = request.nextUrl.origin;
    const testUrl = `${origin}/tests/${testId}/edit`;

    // PNG バッファを生成
    const buffer = await QRCode.toBuffer(testUrl, {
      type: "png",
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="qr-test-${testId}.png"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("QR generation error:", error);
    return NextResponse.json({ error: "QR code generation failed" }, { status: 500 });
  }
}
