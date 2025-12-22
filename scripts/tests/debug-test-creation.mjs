/**
 * テスト作成エラーの原因を調査するスクリプト
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "tests.db");
const db = new Database(dbPath);

console.log("🔍 テスト作成エラーの原因調査\n");

// 1. フォルダテーブルの構造確認
console.log("=== 1. フォルダテーブルの構造 ===");
const schema = db
  .prepare(
    `
  SELECT sql FROM sqlite_master 
  WHERE type='table' AND name='folders'
`
  )
  .get();
console.log(schema.sql);
console.log("");

// 2. 全フォルダの確認
console.log("=== 2. 全フォルダ一覧 ===");
const folders = db
  .prepare(
    `
  SELECT id, name, parent_id 
  FROM folders 
  ORDER BY id
`
  )
  .all();
console.log(`フォルダ数: ${folders.length}件`);
folders.forEach((f) => {
  console.log(`  [${f.id}] ${f.name} (parent_id: ${f.parent_id || "null"})`);
});
console.log("");

// 3. 「未分類」フォルダの確認
console.log("=== 3. 未分類フォルダの確認 ===");
const uncategorized = db
  .prepare(
    `
  SELECT * FROM folders WHERE name = '未分類'
`
  )
  .all();
console.log(`未分類フォルダ数: ${uncategorized.length}件`);
uncategorized.forEach((f) => {
  console.log(`  [${f.id}] parent_id: ${f.parent_id || "null"}`);
});
console.log("");

// 4. 同名フォルダの確認(異なる親)
console.log("=== 4. 同名フォルダの確認 ===");
const sameNames = db
  .prepare(
    `
  SELECT name, COUNT(*) as count
  FROM folders
  GROUP BY name
  HAVING count > 1
`
  )
  .all();
if (sameNames.length > 0) {
  console.log("同名フォルダが存在します:");
  sameNames.forEach((n) => {
    console.log(`  - "${n.name}": ${n.count}件`);
    const details = db
      .prepare(
        `
      SELECT id, name, parent_id FROM folders WHERE name = ?
    `
      )
      .all(n.name);
    details.forEach((d) => {
      console.log(`    [${d.id}] parent_id: ${d.parent_id || "null"}`);
    });
  });
} else {
  console.log("同名フォルダなし");
}
console.log("");

// 5. UNIQUE制約の確認
console.log("=== 5. UNIQUE制約の確認 ===");
const indexes = db
  .prepare(
    `
  SELECT name, sql FROM sqlite_master 
  WHERE type='index' AND tbl_name='folders'
`
  )
  .all();
console.log(`インデックス数: ${indexes.length}件`);
indexes.forEach((idx) => {
  console.log(`  ${idx.name}:`);
  console.log(`    ${idx.sql || "(自動生成)"}`);
});
console.log("");

// 6. 最近のテスト作成試行をシミュレーション
console.log("=== 6. テスト作成シミュレーション ===");
try {
  // 未分類フォルダを取得
  const uncategorizedFolder = db
    .prepare("SELECT id FROM folders WHERE name = '未分類'")
    .get();

  if (uncategorizedFolder) {
    console.log(
      `✅ 未分類フォルダが見つかりました: ID=${uncategorizedFolder.id}`
    );

    // テスト挿入を試行(実際には挿入しない)
    console.log("\nテスト挿入をDRY-RUNで試行...");
    const testData = {
      name: "テストサンプル",
      subject: "数学",
      grade: "中1",
      folder_id: uncategorizedFolder.id,
      pdf_path: null,
      description: null,
      total_questions: null,
      total_score: null,
    };
    console.log("挿入データ:", JSON.stringify(testData, null, 2));

    // folder_idが実際に存在するか確認
    const folderExists = db
      .prepare("SELECT id FROM folders WHERE id = ?")
      .get(uncategorizedFolder.id);

    if (folderExists) {
      console.log("✅ folder_idは有効です");
    } else {
      console.log("❌ folder_idが存在しません!");
    }
  } else {
    console.log("❌ 未分類フォルダが見つかりません!");
  }
} catch (error) {
  console.log("❌ エラー:", error.message);
}
console.log("");

// 7. test_foldersテーブルの確認
console.log("=== 7. test_foldersテーブルの構造 ===");
const testFoldersSchema = db
  .prepare(
    `
  SELECT sql FROM sqlite_master 
  WHERE type='table' AND name='test_folders'
`
  )
  .get();
console.log(testFoldersSchema?.sql || "テーブルが存在しません");
console.log("");

db.close();
console.log("✅ 調査完了");
