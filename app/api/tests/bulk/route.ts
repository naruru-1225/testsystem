import { NextResponse } from "next/server";
import { testRepository } from "@/lib/repositories/testRepository";
import { withErrorHandling, validationError } from "@/lib/api-utils";
import db from "@/lib/db/db-instance";

/**
 * テスト一括操作API
 * DELETE /api/tests/bulk  - 複数テストを一括削除
 * PATCH  /api/tests/bulk  - 複数テストを一括更新（フォルダ移動・学年/科目変更・タグ付与）
 */

export const DELETE = withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const { ids } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return validationError("削除するテストIDを指定してください");
  }

  const deleted: number[] = [];
  const errors: { id: number; error: string }[] = [];

  for (const id of ids) {
    try {
      testRepository.delete(Number(id));
      deleted.push(Number(id));
    } catch (err) {
      errors.push({ id: Number(id), error: String(err) });
    }
  }

  return NextResponse.json({ deleted, errors, count: deleted.length });
});

export const PATCH = withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const { ids, folderId, grade, subject, tagIds, addTagIds, removeTagIds } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return validationError("更新するテストIDを指定してください");
  }

  const numIds = ids.map(Number);

  // フォルダ移動
  if (folderId !== undefined) {
    const stmt = db.prepare("UPDATE tests SET folder_id = ?, updated_at = datetime('now') WHERE id = ?");
    const transaction = db.transaction(() => {
      for (const id of numIds) {
        stmt.run(folderId === null ? null : Number(folderId), id);
      }
    });
    transaction();
  }

  // 学年一括変更
  if (grade !== undefined) {
    const stmt = db.prepare("UPDATE tests SET grade = ?, updated_at = datetime('now') WHERE id = ?");
    const transaction = db.transaction(() => {
      for (const id of numIds) {
        stmt.run(grade, id);
      }
    });
    transaction();
  }

  // 科目一括変更
  if (subject !== undefined) {
    const stmt = db.prepare("UPDATE tests SET subject = ?, updated_at = datetime('now') WHERE id = ?");
    const transaction = db.transaction(() => {
      for (const id of numIds) {
        stmt.run(subject, id);
      }
    });
    transaction();
  }

  // タグ一括付与（addTagIds: 既存を保持しつつ追加）
  if (addTagIds && Array.isArray(addTagIds) && addTagIds.length > 0) {
    const insertStmt = db.prepare(
      "INSERT OR IGNORE INTO test_tags (test_id, tag_id) VALUES (?, ?)"
    );
    const transaction = db.transaction(() => {
      for (const testId of numIds) {
        for (const tagId of addTagIds) {
          insertStmt.run(testId, Number(tagId));
        }
      }
    });
    transaction();
  }

  // タグ一括削除（removeTagIds）
  if (removeTagIds && Array.isArray(removeTagIds) && removeTagIds.length > 0) {
    const deleteStmt = db.prepare(
      "DELETE FROM test_tags WHERE test_id = ? AND tag_id = ?"
    );
    const transaction = db.transaction(() => {
      for (const testId of numIds) {
        for (const tagId of removeTagIds) {
          deleteStmt.run(testId, Number(tagId));
        }
      }
    });
    transaction();
  }

  // タグ上書き（tagIds: 既存を全削除して再設定）
  if (tagIds !== undefined && Array.isArray(tagIds)) {
    const deleteAll = db.prepare("DELETE FROM test_tags WHERE test_id = ?");
    const insertStmt = db.prepare(
      "INSERT OR IGNORE INTO test_tags (test_id, tag_id) VALUES (?, ?)"
    );
    const transaction = db.transaction(() => {
      for (const testId of numIds) {
        deleteAll.run(testId);
        for (const tagId of tagIds) {
          insertStmt.run(testId, Number(tagId));
        }
      }
    });
    transaction();
  }

  return NextResponse.json({ updated: numIds, count: numIds.length });
});
