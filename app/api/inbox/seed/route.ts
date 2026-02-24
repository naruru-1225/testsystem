import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-utils";
import { emailInboxRepository } from "@/lib/repositories/emailInboxRepository";
import fs from "fs";
import path from "path";

// 最小限の有効なPDFバイナリ
function createMinimalPdf(title: string): Buffer {
  const content = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f\r
0000000009 00000 n\r
0000000058 00000 n\r
0000000115 00000 n\r
trailer<</Size 4/Root 1 0 R>>
startxref
200
%%EOF`;
  return Buffer.from(content, "utf-8");
}

const SEED_ITEMS = [
  {
    subject: "2024年度 第1回 数学定期テスト（1年生）",
    from: "teacher@school.example.com",
  },
  {
    subject: "英語 実力テスト 2024-05",
    from: "english@school.example.com",
  },
  {
    subject: "理科 小テスト（化学分野）",
    from: "science@school.example.com",
  },
  {
    subject: "社会 模擬試験 問題用紙",
    from: "social@school.example.com",
  },
  {
    subject: "国語 定期テスト（現代文）",
    from: "japanese@school.example.com",
  },
  {
    subject: "数学 追試験 2025年1月",
    from: "math2@school.example.com",
  },
  {
    subject: "英語 リスニング小テスト",
    from: "english@school.example.com",
  },
];

/**
 * 受信トレイシードデータ挿入 POST /api/inbox/seed
 * 開発・テスト用ダミーデータを投入する
 */
export const POST = withErrorHandling(async () => {
  const inboxDir = path.join(process.cwd(), "public", "uploads", "pdfs", "inbox");
  if (!fs.existsSync(inboxDir)) {
    fs.mkdirSync(inboxDir, { recursive: true });
  }

  const added: string[] = [];

  for (const item of SEED_ITEMS) {
    const safeFileName = `seed-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.pdf`;
    const filePath = path.join(inboxDir, safeFileName);
    const publicPath = `/uploads/pdfs/inbox/${safeFileName}`;

    // ダミーPDF作成
    const pdfBuffer = createMinimalPdf(item.subject);
    fs.writeFileSync(filePath, pdfBuffer);

    // 受信トレイに追加（重複チェック付き）
    const msgId = `seed::${item.subject}::${safeFileName}`;
    if (!emailInboxRepository.isImported(msgId)) {
      emailInboxRepository.add({
        file_name: safeFileName,
        file_path: publicPath,
        original_subject: item.subject,
        from_address: item.from,
        message_id: msgId,
      });
      added.push(item.subject);
    }

    // 連続挿入のためのタイムスタンプずらし
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  return NextResponse.json({
    success: true,
    added: added.length,
    items: added,
  });
});
