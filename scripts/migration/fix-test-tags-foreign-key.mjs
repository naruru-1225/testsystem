/**
 * test_tagsテーブルの外部キー制約を修正するスクリプト
 * tests_backup → tests に変更
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "tests.db");
const db = new Database(dbPath);

// 外部キー制約を一時的に無効化
db.pragma("foreign_keys = OFF");

console.log("🔧 test_tagsテーブルの外部キー制約を修正します...\n");

try {
  db.exec("BEGIN TRANSACTION");

  // 1. 既存のtest_tagsテーブルをバックアップ
  console.log("📝 既存のtest_tagsテーブルをバックアップ...");
  db.exec(`
    CREATE TABLE test_tags_backup AS SELECT * FROM test_tags
  `);

  // 2. 既存のテーブルを削除
  db.exec("DROP TABLE test_tags");

  // 3. 新しいテーブルを正しい外部キー制約で作成
  console.log("📝 新しいtest_tagsテーブルを作成...");
  db.exec(`
    CREATE TABLE test_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
      UNIQUE(test_id, tag_id)
    )
  `);

  // 4. データを新しいテーブルに移行
  console.log("📝 データを移行...");
  const result = db.exec(
    "INSERT INTO test_tags SELECT * FROM test_tags_backup"
  );

  // 移行したレコード数を取得
  const count = db.prepare("SELECT COUNT(*) as count FROM test_tags").get();
  console.log(`   移行されたレコード数: ${count.count}件`);

  // 5. AUTOINCREMENTシーケンスを更新
  const maxId = db.prepare("SELECT MAX(id) as maxId FROM test_tags").get();
  if (maxId.maxId) {
    db.prepare(
      "UPDATE sqlite_sequence SET seq = ? WHERE name = 'test_tags'"
    ).run(maxId.maxId);
  }

  // 6. バックアップテーブルを削除
  console.log("📝 バックアップテーブルを削除...");
  db.exec("DROP TABLE test_tags_backup");

  db.exec("COMMIT");

  // 外部キー制約を再度有効化
  db.pragma("foreign_keys = ON");

  console.log("\n✅ マイグレーション完了!");

  // 修正後の構造を確認
  const schema = db
    .prepare("SELECT sql FROM sqlite_master WHERE name = 'test_tags'")
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
