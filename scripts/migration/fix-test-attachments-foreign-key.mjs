/**
 * test_attachmentsテーブルの外部キー制約を修正するスクリプト
 * tests_backup → tests に変更
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "tests.db");
const db = new Database(dbPath);

// 外部キー制約を一時的に無効化
db.pragma("foreign_keys = OFF");

console.log("🔧 test_attachmentsテーブルの外部キー制約を修正します...\n");

try {
  db.exec("BEGIN TRANSACTION");

  // 1. 既存のtest_attachmentsテーブルをバックアップ
  console.log("📝 既存のtest_attachmentsテーブルをバックアップ...");
  db.exec(`
    CREATE TABLE test_attachments_backup AS SELECT * FROM test_attachments
  `);

  // 2. 既存のテーブルを削除
  db.exec("DROP TABLE test_attachments");

  // 3. 新しいテーブルを正しい外部キー制約で作成
  console.log("📝 新しいtest_attachmentsテーブルを作成...");
  db.exec(`
    CREATE TABLE test_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      mime_type TEXT,
      file_size INTEGER,
      FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE CASCADE
    )
  `);

  // 4. データを新しいテーブルに移行
  console.log("📝 データを移行...");
  const result = db.exec(
    "INSERT INTO test_attachments SELECT * FROM test_attachments_backup"
  );

  // 移行したレコード数を取得
  const count = db
    .prepare("SELECT COUNT(*) as count FROM test_attachments")
    .get();
  console.log(`   移行されたレコード数: ${count.count}件`);

  // 5. AUTOINCREMENTシーケンスを更新
  const maxId = db
    .prepare("SELECT MAX(id) as maxId FROM test_attachments")
    .get();
  if (maxId.maxId) {
    db.prepare(
      "UPDATE sqlite_sequence SET seq = ? WHERE name = 'test_attachments'"
    ).run(maxId.maxId);
  }

  // 6. バックアップテーブルを削除
  console.log("📝 バックアップテーブルを削除...");
  db.exec("DROP TABLE test_attachments_backup");

  db.exec("COMMIT");

  // 外部キー制約を再度有効化
  db.pragma("foreign_keys = ON");

  console.log("\n✅ マイグレーション完了!");

  // 修正後の構造を確認
  const schema = db
    .prepare("SELECT sql FROM sqlite_master WHERE name = 'test_attachments'")
    .get();

  console.log("\n✅ 外部キー制約が正しく修正されました!");
  const fkMatch = schema.sql.match(
    /FOREIGN KEY \(test_id\) REFERENCES (.+?) \(/
  );
  if (fkMatch) {
    console.log(`   FOREIGN KEY (test_id) REFERENCES ${fkMatch[1]}`);
  }
} catch (error) {
  db.exec("ROLLBACK");
  console.error("❌ エラーが発生しました:", error.message);
  process.exit(1);
} finally {
  db.close();
}
