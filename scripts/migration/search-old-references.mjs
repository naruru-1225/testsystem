/**
 * データベース内のすべてのfolders_old参照を検索するスクリプト
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "tests.db");
const db = new Database(dbPath);

console.log("🔍 データベース内のfolders_old参照を検索中...\n");

// 1. すべてのテーブル構造を確認
console.log("=== 1. すべてのテーブル ===");
const tables = db
  .prepare(
    `
  SELECT name, type, sql FROM sqlite_master 
  WHERE type IN ('table', 'index', 'trigger', 'view')
  ORDER BY type, name
`
  )
  .all();

console.log(`見つかったオブジェクト: ${tables.length}件\n`);

let foundOldReference = false;

tables.forEach((obj) => {
  const sql = obj.sql || "";
  if (sql.toLowerCase().includes("folders_old")) {
    foundOldReference = true;
    console.log(`❌ [${obj.type}] ${obj.name}`);
    console.log(`   SQL: ${sql}`);
    console.log("");
  }
});

if (!foundOldReference) {
  console.log("✅ folders_oldへの参照は見つかりませんでした");
}

console.log("\n=== 2. 全テーブル一覧 ===");
const allTables = db
  .prepare(
    `
  SELECT name FROM sqlite_master 
  WHERE type='table' AND name NOT LIKE 'sqlite_%'
  ORDER BY name
`
  )
  .all();

allTables.forEach((t) => {
  console.log(`  - ${t.name}`);
});

console.log("\n=== 3. folders関連のすべてのオブジェクト ===");
const foldersObjects = db
  .prepare(
    `
  SELECT name, type, sql FROM sqlite_master 
  WHERE sql LIKE '%folders%' OR name LIKE '%folders%'
  ORDER BY type, name
`
  )
  .all();

foldersObjects.forEach((obj) => {
  console.log(`\n[${obj.type}] ${obj.name}:`);
  console.log(obj.sql || "(SQL定義なし)");
});

db.close();
console.log("\n✅ 検索完了");
