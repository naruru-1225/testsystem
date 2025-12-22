/**
 * 安全なマイグレーションスクリプトのテスト
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "tests.db");
const db = new Database(dbPath);

console.log("=".repeat(70));
console.log("🧪 マイグレーションスクリプトの検証");
console.log("=".repeat(70));

try {
  // 1. 現在の状態確認
  console.log("\n[1] データ件数:");
  console.log("-".repeat(70));

  const counts = {
    folders: db.prepare("SELECT COUNT(*) as count FROM folders").get().count,
    tests: db.prepare("SELECT COUNT(*) as count FROM tests").get().count,
    test_folders: db.prepare("SELECT COUNT(*) as count FROM test_folders").get()
      .count,
    test_tags: db.prepare("SELECT COUNT(*) as count FROM test_tags").get()
      .count,
    test_attachments: db
      .prepare("SELECT COUNT(*) as count FROM test_attachments")
      .get().count,
  };

  Object.entries(counts).forEach(([table, count]) => {
    console.log(`  ${table}: ${count}件`);
  });

  // 2. テーブル構造の確認
  console.log("\n[2] テーブル構造の確認:");
  console.log("-".repeat(70));

  const tables = ["tests", "test_folders", "test_tags", "test_attachments"];
  let needsMigration = false;

  tables.forEach((table) => {
    const schema = db
      .prepare(
        `
      SELECT sql FROM sqlite_master WHERE type='table' AND name=?
    `
      )
      .get(table);

    if (
      schema.sql.includes("folders_old") ||
      schema.sql.includes("tests_backup")
    ) {
      console.log(`  ${table}: ⚠️  古い参照あり - マイグレーション必要`);
      needsMigration = true;
    } else {
      console.log(`  ${table}: ✅ 正常`);
    }
  });

  // 3. 結果
  console.log("\n" + "=".repeat(70));

  if (!needsMigration) {
    console.log("✅ すべてのテーブルが正しい状態です");
    console.log(
      "\n📋 マイグレーションスクリプトは以下の場合に使用してください:"
    );
    console.log("   1. 本番環境でfolders_old参照が残っている場合");
    console.log("   2. tests_backup参照が残っている場合");
    console.log("\n実行方法:");
    console.log("   node run-safe-migrations.mjs");
  } else {
    console.log("⚠️  マイグレーションが必要です");
    console.log("\n実行してください:");
    console.log("   node run-safe-migrations.mjs");
  }

  console.log("=".repeat(70));
} catch (error) {
  console.error("\n❌ エラー:", error.message);
  process.exit(1);
} finally {
  db.close();
}
