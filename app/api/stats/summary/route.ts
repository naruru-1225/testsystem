/**
 * 統計情報API
 * GET /api/stats/summary
 *
 * @description
 * システム全体の統計データを返します:
 * - 総テスト数、フォルダ数、タグ数
 * - 学年別・科目別のテスト数
 * - タグ使用頻度トップ10
 * - フォルダ別テスト数トップ10
 * - 最近追加されたテスト10件
 *
 * @returns 統計情報のJSON
 */

import { NextResponse } from "next/server";
import { statsRepository } from "@/lib/repositories/statsRepository";
import { withErrorHandling } from "@/lib/api-utils";

/**
 * GET /api/stats/summary
 * システム統計情報を取得
 */
export const GET = withErrorHandling(async () => {
  const summary = statsRepository.getSummary();
  return NextResponse.json(summary);
});
