/**
 * 未分類フォルダの表示テスト
 * テスト一覧で未分類フォルダが表示されないことを確認
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dbPath = path.join(__dirname, "data", "tests.db");

console.log("=".repeat(60));
console.log("📋 未分類フォルダの表示テスト");
console.log("=".repeat(60));

try {
  const db = new Database(dbPath, { readonly: true });

  // テストデータとフォルダの関連を取得
  const tests = db
    .prepare(
      `
    SELECT 
      t.id,
      t.name,
      t.grade,
      t.subject
    FROM tests t
    ORDER BY t.created_at DESC
  `
    )
    .all();

  console.log(`\nテスト件数: ${tests.length}件\n`);

  tests.forEach((test) => {
    console.log("-".repeat(60));
    console.log(`テスト: ${test.name}`);
    console.log(`学年: ${test.grade}, 科目: ${test.subject}`);

    // このテストに紐づくフォルダを取得
    const folders = db
      .prepare(
        `
      SELECT f.id, f.name
      FROM folders f
      INNER JOIN test_folders tf ON f.id = tf.folder_id
      WHERE tf.test_id = ?
      ORDER BY f.name
    `
      )
      .all(test.id);

    console.log(`所属フォルダ: ${folders.length}件`);
    folders.forEach((folder) => {
      const isUncategorized = folder.name === "未分類";
      const displayStatus = isUncategorized ? "❌ 表示しない" : "✅ 表示する";
      console.log(`  - ${folder.name} (ID: ${folder.id}) ${displayStatus}`);
    });

    // 未分類以外のフォルダをフィルタ
    const displayedFolders = folders.filter((f) => f.name !== "未分類");
    console.log(`画面に表示されるフォルダ: ${displayedFolders.length}件`);
    if (displayedFolders.length > 0) {
      displayedFolders.forEach((f) => {
        console.log(`  ✓ ${f.name}`);
      });
    } else {
      console.log(`  (なし - 未分類のみのテスト)`);
    }
  });

  console.log("\n" + "=".repeat(60));
  console.log("✓ テスト完了");
  console.log("=".repeat(60));
  console.log("\n期待される動作:");
  console.log("  - 未分類フォルダのみに所属するテストは、所属欄が空表示される");
  console.log(
    "  - 未分類 + 他のフォルダに所属する場合は、他のフォルダのみ表示される"
  );
  console.log("  - 未分類以外のフォルダは通常通り表示される\n");

  db.close();
} catch (error) {
  console.error("❌ エラー:", error.message);
  console.error(error);
  process.exit(1);
}
