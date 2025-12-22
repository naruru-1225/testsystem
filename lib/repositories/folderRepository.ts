import db from "../db-instance";
import { getDescendantFolderIds } from "../db-helpers";

export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  created_at: string;
}

export const folderRepository = {
  getAll: () => {
    return db.prepare("SELECT * FROM folders ORDER BY order_index ASC, id ASC").all() as Folder[];
  },

  getById: (id: number) => {
    return db.prepare("SELECT * FROM folders WHERE id = ?").get(id) as Folder | undefined;
  },

  create: (name: string, parentId: number | null) => {
    const stmt = db.prepare(
      "INSERT INTO folders (name, parent_id) VALUES (?, ?)"
    );
    const result = stmt.run(name, parentId);
    return {
      id: result.lastInsertRowid as number,
      name,
      parent_id: parentId,
    };
  },

  update: (id: number, name: string, parentId: number | null) => {
    const stmt = db.prepare(
      "UPDATE folders SET name = ?, parent_id = ? WHERE id = ?"
    );
    stmt.run(name, parentId, id);
    return { id, name, parent_id: parentId };
  },

  updateOrder: (folderIds: number[]) => {
    const updateStmt = db.prepare(
      "UPDATE folders SET order_index = ? WHERE id = ?"
    );
    const transaction = db.transaction((ids: number[]) => {
      ids.forEach((id, index) => {
        updateStmt.run(index, id);
      });
    });
    transaction(folderIds);
  },

  delete: (id: number, moveTestsToUncategorized: boolean = false) => {
    // トランザクションで削除を実行
    const deleteTransaction = db.transaction(() => {
      // 1. 子孫フォルダのIDを取得
      const descendantIds = getDescendantFolderIds(id);
      const allIdsToDelete = [id, ...descendantIds];

      if (moveTestsToUncategorized) {
        // 未分類フォルダを取得または作成
        let uncategorizedFolder = db
          .prepare("SELECT id FROM folders WHERE name = '未分類'")
          .get() as Folder | undefined;

        if (!uncategorizedFolder) {
          const result = db
            .prepare("INSERT INTO folders (name) VALUES ('未分類')")
            .run();
          uncategorizedFolder = { id: Number(result.lastInsertRowid) } as Folder;
        }

        // 削除対象のフォルダをメインフォルダとしているテストを未分類に移動
        const placeholders = allIdsToDelete.map(() => "?").join(",");
        const testsToMove = db.prepare(
          `SELECT id FROM tests WHERE folder_id IN (${placeholders})`
        ).all(...allIdsToDelete) as { id: number }[];

        for (const test of testsToMove) {
          db.prepare("UPDATE tests SET folder_id = ? WHERE id = ?").run(
            uncategorizedFolder.id,
            test.id
          );
          // test_foldersにも未分類を追加（なければ）
          db.prepare(
            "INSERT OR IGNORE INTO test_folders (test_id, folder_id) VALUES (?, ?)"
          ).run(test.id, uncategorizedFolder.id);
        }
      }

      // 2. 削除対象のフォルダに含まれるテストの関連付けを解除
      const placeholders = allIdsToDelete.map(() => "?").join(",");
      const deleteTestFolders = db.prepare(
        `DELETE FROM test_folders WHERE folder_id IN (${placeholders})`
      );
      deleteTestFolders.run(...allIdsToDelete);

      // 3. フォルダを削除 (子孫も含む)
      const deleteFolders = db.prepare(
        `DELETE FROM folders WHERE id IN (${placeholders})`
      );
      deleteFolders.run(...allIdsToDelete);
    });

    deleteTransaction();
  },

  checkNameExists: (name: string, parentId: number | null, excludeId?: number) => {
    let query = "SELECT 1 FROM folders WHERE name = ? AND ";
    const params: any[] = [name];

    if (parentId === null) {
      query += "parent_id IS NULL";
    } else {
      query += "parent_id = ?";
      params.push(parentId);
    }

    if (excludeId) {
      query += " AND id != ?";
      params.push(excludeId);
    }

    const result = db.prepare(query).get(...params);
    return !!result;
  },

  getUncategorized: () => {
    return db.prepare("SELECT * FROM folders WHERE name = '未分類'").get() as Folder | undefined;
  },

  getTestCount: (folderId: number) => {
    const result = db
      .prepare("SELECT COUNT(*) as count FROM test_folders WHERE folder_id = ?")
      .get(folderId) as { count: number };
    return result.count;
  },
};
