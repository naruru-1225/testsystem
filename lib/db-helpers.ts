import db from "./db-instance";

/**
 * 指定されたフォルダの子孫フォルダIDを全て取得する(再帰的)
 * @param folderId 親フォルダID
 * @returns 子孫フォルダIDの配列
 */
export function getDescendantFolderIds(folderId: number): number[] {
  const descendants: number[] = [];
  const children = db
    .prepare("SELECT id FROM folders WHERE parent_id = ?")
    .all(folderId) as { id: number }[];

  for (const child of children) {
    descendants.push(child.id);
    // 再帰的に孫フォルダも取得
    descendants.push(...getDescendantFolderIds(child.id));
  }

  return descendants;
}

/**
 * テーブルにカラムが存在するか確認し、存在しない場合は追加する
 * @param tableName テーブル名
 * @param columnName カラム名
 * @param columnType カラムの型定義 (例: "TEXT", "INTEGER DEFAULT 0")
 */
export function addColumnIfNotExists(tableName: string, columnName: string, columnType: string) {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    const hasColumn = tableInfo.some((col: any) => col.name === columnName);
    
    if (!hasColumn) {
      console.log(`Adding ${columnName} column to ${tableName} table...`);
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`);
      console.log(`${columnName} column added successfully.`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error adding column ${columnName} to ${tableName}:`, error);
    return false;
  }
}
