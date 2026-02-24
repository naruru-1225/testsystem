import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { withErrorHandling } from "@/lib/api-utils";

const BACKUP_DIR = path.join(process.cwd(), "backups");

function getDirSize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += getDirSize(full);
    } else {
      try {
        total += fs.statSync(full).size;
      } catch {
        // ignore
      }
    }
  }
  return total;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * バックアップ一覧取得API (#73)
 * GET /api/backup/list
 */
export const GET = withErrorHandling(async () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    return NextResponse.json([]);
  }

  const entries = fs.readdirSync(BACKUP_DIR, { withFileTypes: true });
  const backups = entries
    .filter((e) => e.isDirectory() && e.name.startsWith("backup-"))
    .map((e) => {
      const dirPath = path.join(BACKUP_DIR, e.name);
      const stat = fs.statSync(dirPath);
      const sizeBytes = getDirSize(dirPath);
      // Parse timestamp from folder name: backup-2025-11-19T05-35-36-058Z
      const tsStr = e.name.replace("backup-", "").replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ":$1:$2.$3Z");
      return {
        name: e.name,
        createdAt: stat.birthtime.toISOString(),
        size: sizeBytes,
        sizeFormatted: formatBytes(sizeBytes),
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json(backups);
});
