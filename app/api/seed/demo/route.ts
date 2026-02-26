import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-utils";
import { folderRepository } from "@/lib/repositories/folderRepository";
import { tagRepository } from "@/lib/repositories/tagRepository";
import { testRepository } from "@/lib/repositories/testRepository";
import db from "@/lib/db/db-instance";

/**
 * デモデータ投入API
 * POST /api/seed/demo
 * フォルダ・タグ・テストのサンプルデータを作成する
 */
export const POST = withErrorHandling(async () => {
  const result = {
    folders: 0,
    tags: 0,
    tests: 0,
  };

  // ---- フォルダ作成 ----
  const folderDefs = [
    { name: "2024年度", parent: null },
    { name: "1年生", parent: "2024年度" },
    { name: "2年生", parent: "2024年度" },
    { name: "3年生", parent: "2024年度" },
    { name: "定期テスト", parent: "1年生" },
    { name: "実力テスト", parent: "1年生" },
    { name: "定期テスト", parent: "2年生" },
    { name: "模擬試験", parent: "3年生" },
  ];

  const folderMap: Record<string, number> = {};
  // まず toplevel
  for (const fd of folderDefs) {
    const existingAll = (folderRepository.getAll() as { id: number; name: string; parent_id: number | null }[]);
    const parentId = fd.parent ? (folderMap[fd.parent] ?? null) : null;
    const exists = existingAll.find(
      (f) => f.name === fd.name && f.parent_id === parentId
    );
    if (!exists) {
      const newFolder = folderRepository.create(fd.name, parentId);
      folderMap[fd.name] = newFolder.id;
      result.folders++;
    } else {
      folderMap[fd.name] = exists.id;
    }
  }

  // ---- タグ作成 ----
  const tagDefs = [
    { name: "定期テスト", color: "#3B82F6" },
    { name: "実力テスト", color: "#10B981" },
    { name: "小テスト", color: "#F59E0B" },
    { name: "重要", color: "#EF4444" },
    { name: "模擬試験", color: "#8B5CF6" },
    { name: "補講", color: "#EC4899" },
  ];

  const tagMap: Record<string, number> = {};
  const existingTags = (tagRepository.getAll() as { id: number; name: string }[]);
  for (const td of tagDefs) {
    const exists = existingTags.find((t) => t.name === td.name);
    if (!exists) {
      const newTag = tagRepository.create(td.name, td.color);
      tagMap[td.name] = newTag.id;
      result.tags++;
    } else {
      tagMap[td.name] = exists.id;
    }
  }

  // ---- テスト作成 ----
  const testDefs = [
    {
      name: "2024年度 1年生 第1回数学定期テスト",
      subject: "数学",
      grade: "1年生",
      folderName: "定期テスト",
      tagNames: ["定期テスト"],
    },
    {
      name: "2024年度 1年生 第1回英語定期テスト",
      subject: "英語",
      grade: "1年生",
      folderName: "定期テスト",
      tagNames: ["定期テスト"],
    },
    {
      name: "2024年度 1年生 国語小テスト（現代文）",
      subject: "国語",
      grade: "1年生",
      folderName: "定期テスト",
      tagNames: ["小テスト"],
    },
    {
      name: "2024年度 1年生 理科 実力テスト",
      subject: "理科",
      grade: "1年生",
      folderName: "実力テスト",
      tagNames: ["実力テスト", "重要"],
    },
    {
      name: "2024年度 2年生 数学 中間テスト",
      subject: "数学",
      grade: "2年生",
      folderName: "定期テスト",
      tagNames: ["定期テスト"],
    },
    {
      name: "2024年度 2年生 英語 期末テスト",
      subject: "英語",
      grade: "2年生",
      folderName: "定期テスト",
      tagNames: ["定期テスト"],
    },
    {
      name: "2024年度 2年生 社会 実力テスト",
      subject: "社会",
      grade: "2年生",
      folderName: "定期テスト",
      tagNames: ["実力テスト"],
    },
    {
      name: "2024年度 3年生 入試対策模試 第1回",
      subject: "総合",
      grade: "3年生",
      folderName: "模擬試験",
      tagNames: ["模擬試験", "重要"],
    },
    {
      name: "2024年度 3年生 入試対策模試 第2回",
      subject: "総合",
      grade: "3年生",
      folderName: "模擬試験",
      tagNames: ["模擬試験", "重要"],
    },
    {
      name: "2024年度 3年生 数学 最終確認テスト",
      subject: "数学",
      grade: "3年生",
      folderName: "模擬試験",
      tagNames: ["定期テスト", "重要"],
    },
  ];

  const existingTests = (db
    .prepare("SELECT name FROM tests")
    .all() as { name: string }[]).map((t) => t.name);

  for (const td of testDefs) {
    if (existingTests.includes(td.name)) continue;
    const folderId = folderMap[td.folderName] ?? null;
    const tagIds = td.tagNames.map((n) => tagMap[n]).filter(Boolean) as number[];
    testRepository.create({
      name: td.name,
      subject: td.subject,
      grade: td.grade,
      folderId: folderId ?? 0,
      folderIds: folderId ? [folderId] : [],
      tagIds,
    });
    result.tests++;
  }

  return NextResponse.json({
    success: true,
    ...result,
    message: `フォルダ ${result.folders} 件、タグ ${result.tags} 件、テスト ${result.tests} 件を作成しました`,
  });
});
