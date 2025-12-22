/**
 * 安全なtest_attachmentsテーブルのマイグレーション
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "tests.db");
const db = new Database(dbPath);

console.log("=".repeat(70));
console.log("🔄 test_attachmentsテーブルの安全なマイグレーション");
console.log("=".repeat(70));

try {
  console.log("\n[1] マイグレーション前の状態確認:");
  console.log("-".repeat(70));

  const beforeCount = db
    .prepare("SELECT COUNT(*) as count FROM test_attachments")
    .get();
  console.log(`  現在のtest_attachments数: ${beforeCount.count}件`);

  const currentSchema = db
    .prepare(
      `
    SELECT sql FROM sqlite_master 
    WHERE type='table' AND name='test_attachments'
  `
    )
    .get();

  // 各カラムの有無を確認
  const hasCreatedAt = currentSchema.sql.includes("created_at");
  const hasFileType = currentSchema.sql.includes("file_type");
  const hasFileSize = currentSchema.sql.includes("file_size");
  
  console.log(`  現在のテーブル構造: ${currentSchema.sql.substring(0, 100)}...`);
  console.log(`  created_atカラム: ${hasCreatedAt ? "あり" : "なし"}`);
  console.log(`  file_typeカラム: ${hasFileType ? "あり" : "なし"}`);
  console.log(`  file_sizeカラム: ${hasFileSize ? "あり" : "なし"}`);

  if (!currentSchema.sql.includes("tests_backup")) {
    console.log("  ✅ すでにマイグレーション済みです");
    process.exit(0);
  }

  console.log("\n[2] マイグレーションの実行:");
  console.log("-".repeat(70));

  db.pragma("foreign_keys = OFF");
  db.exec("BEGIN TRANSACTION");

  try {
    console.log(
      "  📝 test_attachmentsテーブルを test_attachments_backup にリネーム..."
    );
    db.exec("ALTER TABLE test_attachments RENAME TO test_attachments_backup");

    console.log("  📝 新しいtest_attachmentsテーブルを作成...");
    db.exec(`
      CREATE TABLE test_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT,
        file_size INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE CASCADE
      )
    `);

    console.log("  📝 データをコピー中...");

    // 既存のカラム構成に基づいてSQLを構築
    let insertColumns = "id, test_id, file_path, file_name";
    let selectColumns = "id, test_id, file_path, file_name";
    
    if (hasFileType) {
      insertColumns += ", file_type";
      selectColumns += ", file_type";
    }
    
    if (hasFileSize) {
      insertColumns += ", file_size";
      selectColumns += ", file_size";
    }
    
    if (hasCreatedAt) {
      insertColumns += ", created_at";
      selectColumns += ", created_at";
    }
    
    db.exec(`
      INSERT INTO test_attachments (${insertColumns})
      SELECT ${selectColumns}
      FROM test_attachments_backup
    `);

    const afterCount = db
      .prepare("SELECT COUNT(*) as count FROM test_attachments")
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
    db.exec("DROP TABLE test_attachments_backup");

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
    .prepare("SELECT COUNT(*) as count FROM test_attachments")
    .get();
  console.log(`  最終test_attachments数: ${finalCount.count}件`);

  console.log("\n" + "=".repeat(70));
  console.log("✅ マイグレーションが正常に完了しました!");
  console.log("=".repeat(70));
} catch (error) {
  console.error("\n❌ マイグレーション失敗:", error.message);
  process.exit(1);
} finally {
  db.close();
}
