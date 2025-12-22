/**
 * 安全なtest_tagsテーブルのマイグレーション
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "tests.db");
const db = new Database(dbPath);

console.log("=".repeat(70));
console.log("🔄 test_tagsテーブルの安全なマイグレーション");
console.log("=".repeat(70));

try {
  console.log("\n[1] マイグレーション前の状態確認:");
  console.log("-".repeat(70));

  const beforeCount = db
    .prepare("SELECT COUNT(*) as count FROM test_tags")
    .get();
  console.log(`  現在のtest_tags数: ${beforeCount.count}件`);

  const currentSchema = db
    .prepare(
      `
    SELECT sql FROM sqlite_master 
    WHERE type='table' AND name='test_tags'
  `
    )
    .get();

  // created_atカラムの有無を確認
  const hasCreatedAt = currentSchema.sql.includes("created_at");

  if (!currentSchema.sql.includes("tests_backup")) {
    console.log("  ✅ すでにマイグレーション済みです");
    process.exit(0);
  }

  console.log("\n[2] マイグレーションの実行:");
  console.log("-".repeat(70));

  db.pragma("foreign_keys = OFF");
  db.exec("BEGIN TRANSACTION");

  try {
    console.log("  📝 test_tagsテーブルを test_tags_backup にリネーム...");
    db.exec("ALTER TABLE test_tags RENAME TO test_tags_backup");

    console.log("  📝 新しいtest_tagsテーブルを作成...");
    db.exec(`
      CREATE TABLE test_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
      )
    `);

    console.log("  📝 データをコピー中...");

    // created_atカラムの有無によって異なるSQLを実行
    if (hasCreatedAt) {
      db.exec(`
        INSERT INTO test_tags (id, test_id, tag_id, created_at)
        SELECT id, test_id, tag_id, created_at
        FROM test_tags_backup
      `);
    } else {
      db.exec(`
        INSERT INTO test_tags (id, test_id, tag_id)
        SELECT id, test_id, tag_id
        FROM test_tags_backup
      `);
    }

    const afterCount = db
      .prepare("SELECT COUNT(*) as count FROM test_tags")
      .get();
    console.log(`  📊 コピー前: ${beforeCount.count}件`);
    console.log(`  📊 コピー後: ${afterCount.count}件`);

    if (beforeCount.count !== afterCount.count) {
      throw new Error(
        `データ件数の不一致: ${beforeCount.count} → ${afterCount.count}`
      );
    }

    console.log(`  ✅ すべてのデータが正常にコピーされました`);

    console.log("  🗑️  バックアップテーブルを削除...");
    db.exec("DROP TABLE test_tags_backup");

    db.exec("COMMIT");
    console.log("  ✅ トランザクションをコミットしました");
  } catch (error) {
    console.log(`\n  ❌ エラー: ${error.message}`);
    console.log("  🔄 ロールバック中...");
    db.exec("ROLLBACK");
    console.log("  ✅ ロールバック完了");
    throw error;
  } finally {
    db.pragma("foreign_keys = ON");
  }

  console.log("\n[3] マイグレーション後の確認:");
  console.log("-".repeat(70));

  const finalCount = db
    .prepare("SELECT COUNT(*) as count FROM test_tags")
    .get();
  console.log(`  最終test_tags数: ${finalCount.count}件`);

  console.log("\n" + "=".repeat(70));
  console.log("✅ マイグレーションが正常に完了しました!");
  console.log("=".repeat(70));
} catch (error) {
  console.error("\n❌ マイグレーション失敗:", error.message);
  process.exit(1);
} finally {
  db.close();
}
