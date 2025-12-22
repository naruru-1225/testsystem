/**
 * テストデータのCSVエクスポートAPI
 * GET /api/export/tests
 *
 * クエリパラメータで絞り込んだテストデータをCSV形式でダウンロード
 */

import { NextRequest, NextResponse } from "next/server";
import { testRepository } from "@/lib/repositories/testRepository";
import { withErrorHandling } from "@/lib/api-utils";

/**
 * CSV用文字列のエスケープ処理
 * @param value エスケープ対象の値
 * @returns エスケープされた文字列
 */
function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) return "";

  const str = String(value);
  // カンマ、改行、ダブルクォートを含む場合はダブルクォートで囲む
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * テストデータをCSV形式に変換
 * @param tests テストデータ配列
 * @returns CSV文字列
 */
function convertToCSV(tests: any[]): string {
  // CSVヘッダー
  const headers = [
    "ID",
    "テスト名",
    "科目",
    "学年",
    "フォルダ",
    "大問数",
    "満点",
    "説明",
    "タグ",
    "登録日",
    "更新日",
  ];

  // ヘッダー行
  const csvRows = [headers.join(",")];

  // データ行
  for (const test of tests) {
    const row = [
      escapeCsvValue(test.id),
      escapeCsvValue(test.name),
      escapeCsvValue(test.subject),
      escapeCsvValue(test.grade),
      escapeCsvValue(test.folder_name || ""),
      escapeCsvValue(test.total_questions ?? ""),
      escapeCsvValue(test.total_score ?? ""),
      escapeCsvValue(test.description ?? ""),
      escapeCsvValue(test.tags?.map((t: any) => t.name).join("; ") || ""),
      escapeCsvValue(test.created_at),
      escapeCsvValue(test.updated_at),
    ];
    csvRows.push(row.join(","));
  }

  return csvRows.join("\n");
}

/**
 * GET /api/export/tests
 * フィルタリングされたテストデータをCSV形式でエクスポート
 */
export const GET = withErrorHandling(async (request: Request) => {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  // クエリパラメータを取得
  const folderId = searchParams.get("folderId");
  const grade = searchParams.get("grade");
  const subject = searchParams.get("subject");
  const tagId = searchParams.get("tagId");
  const search = searchParams.get("search");

  // テストデータを取得
  const tests = testRepository.getAll({
    folderId: folderId ? parseInt(folderId) : undefined,
    grade: grade || undefined,
    subject: subject || undefined,
    tagId: tagId ? parseInt(tagId) : undefined,
    search: search || undefined,
  });

  // CSV形式に変換
  const csv = convertToCSV(tests);

  // BOM付きUTF-8でエンコード（Excelでの文字化け防止）
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const csvWithBom = Buffer.concat([
    bom,
    Buffer.from(csv, "utf-8"),
  ]);

  // ファイル名を生成（日時を含む）
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .split("T")[0];
  const filename = `tests_export_${timestamp}.csv`;

  // レスポンスを返す
  return new NextResponse(csvWithBom, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(
        filename
      )}"`,
    },
  });
});
