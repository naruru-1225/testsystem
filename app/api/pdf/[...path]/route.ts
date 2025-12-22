import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * PDFファイルを配信するAPIエンドポイント
 * 他のデバイスからのアクセスでもCORS問題を回避
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Next.js 15ではparamsが非同期になったため、awaitが必要
    const { path: pathArray } = await params;

    // パスパラメータを結合
    const filePath = pathArray.join("/");

    console.log("PDF API - リクエストされたパス:", filePath);
    console.log("PDF API - process.cwd():", process.cwd());

    // publicディレクトリからの相対パスを構築
    const fullPath = join(process.cwd(), "public", "uploads", filePath);

    console.log("PDF API - フルパス:", fullPath);

    // ファイルの存在確認
    const { access } = await import("fs/promises");
    try {
      await access(fullPath);
      console.log("PDF API - ファイルが存在します");
    } catch {
      console.error("PDF API - ファイルが見つかりません:", fullPath);
      return NextResponse.json(
        { error: "PDFファイルが見つかりません", path: fullPath },
        { status: 404 }
      );
    }

    // ファイルを読み込み
    const fileBuffer = await readFile(fullPath);

    console.log(
      "PDF API - ファイル読み込み成功、サイズ:",
      fileBuffer.length,
      "bytes"
    );

    // ファイル拡張子からContent-Typeを決定
    const extension = filePath.split(".").pop()?.toLowerCase() || "";
    let contentType = "application/pdf";
    let contentDisposition = "inline";

    if (["jpg", "jpeg"].includes(extension)) {
      contentType = "image/jpeg";
    } else if (extension === "png") {
      contentType = "image/png";
    } else if (["heic", "heif"].includes(extension)) {
      contentType = "image/heic";
    } else if (extension === "gif") {
      contentType = "image/gif";
    } else if (extension === "webp") {
      contentType = "image/webp";
    } else if (extension === "bmp") {
      contentType = "image/bmp";
    }

    console.log("PDF API - Content-Type:", contentType, "拡張子:", extension);

    // ファイルを適切なContent-Typeで返す
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Range",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    console.error("PDF読み込みエラー:", error);
    return NextResponse.json(
      { error: "PDFファイルの読み込みに失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}

// OPTIONSリクエスト対応（CORS preflight）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
