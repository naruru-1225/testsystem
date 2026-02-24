/**
 * 統計情報API
 * GET /api/stats/summary
 */

import { NextResponse } from "next/server";
import { statsRepository } from "@/lib/repositories/statsRepository";
import { withErrorHandling } from "@/lib/api-utils";
import fs from "fs";
import path from "path";

/** ディレクトリの合計サイズ (bytes) を再帰的に計算 */
function getDirectorySize(dirPath: string): number {
  try {
    if (!fs.existsSync(dirPath)) return 0;
    let total = 0;
    for (const item of fs.readdirSync(dirPath)) {
      const full = path.join(dirPath, item);
      const stat = fs.statSync(full);
      total += stat.isDirectory() ? getDirectorySize(full) : stat.size;
    }
    return total;
  } catch {
    return 0;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * GET /api/stats/summary
 * システム統計情報を取得
 */
export const GET = withErrorHandling(async () => {
  const summary = statsRepository.getSummary();
  const trend = statsRepository.getRegistrationTrend(30);
  const coverage = statsRepository.getSubjectCoverage();

  // ストレージ使用量 (#65)
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  const storageBytes = getDirectorySize(uploadsDir);

  return NextResponse.json({
    ...summary,
    registrationTrend: trend,
    subjectCoverage: coverage,
    storageUsage: { bytes: storageBytes, formatted: formatBytes(storageBytes) },
  });
});
