/**
 * test_foldersテーブルの外部キー制約を修正するマイグレーションスクリプト
 *
 * 問題: test_foldersのFOREIGN KEYが古い"folders_old"を参照している
 * 解決: test_foldersテーブルを再作成して正しい"folders"を参照させる
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "tests.db");
const db = new Database(dbPath);

console.log("🔧 test_foldersテーブルの外部キー制約を修正します...\n");

try {
  // 外部キー制約を一時的に無効化
  db.pragma("foreign_keys = OFF");

  // トランザクション開始
  db.exec("BEGIN TRANSACTION");

  // 1. 既存のtest_foldersテーブルをバックアップ
  console.log("📝 既存のtest_foldersテーブルをバックアップ...");
  db.exec("ALTER TABLE test_folders RENAME TO test_folders_backup");

  // 2. 新しいtest_foldersテーブルを作成(正しい外部キー制約)
  console.log("📝 新しいtest_foldersテーブルを作成...");
  db.exec(`
    CREATE TABLE test_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL,
      folder_id INTEGER NOT NULL,
      FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE,
      UNIQUE(test_id, folder_id)
    )
  `);

  // 3. データを新しいテーブルにコピー
  console.log("📝 データを移行...");
  const copyResult = db.exec(`
    INSERT INTO test_folders (id, test_id, folder_id)
    SELECT id, test_id, folder_id
    FROM test_folders_backup
  `);

  // 4. コピーされたデータ数を確認
  const count = db.prepare("SELECT COUNT(*) as count FROM test_folders").get();
  console.log(`   移行されたレコード数: ${count.count}件`);

  // 5. AUTOINCREMENTのシーケンスを更新
  const maxId = db.prepare("SELECT MAX(id) as max FROM test_folders").get();
  if (maxId && maxId.max) {
    db.exec(`
      INSERT OR REPLACE INTO sqlite_sequence (name, seq) 
      VALUES ('test_folders', ${maxId.max})
    `);
  }

  // 6. バックアップテーブルを削除
  console.log("📝 バックアップテーブルを削除...");
  db.exec("DROP TABLE test_folders_backup");

  // コミット
  db.exec("COMMIT");

  // 外部キー制約を再度有効化
  db.pragma("foreign_keys = ON");

  console.log("✅ マイグレーション完了!\n");

  // 7. 確認
  console.log("📊 修正後の構造確認:");
  const schema = db
    .prepare(
      `
    SELECT sql FROM sqlite_master 
    WHERE type='table' AND name='test_folders'
  `
    )
    .get();
  console.log(schema.sql);
  console.log("");

  console.log("✅ 外部キー制約が正しく修正されました!");
  console.log("   FOREIGN KEY (folder_id) REFERENCES folders (id)");
} catch (error) {
  // エラー時はロールバック
  db.exec("ROLLBACK");
  console.error("❌ マイグレーションエラー:", error);
  console.error("\n詳細:", error.message);
  process.exit(1);
} finally {
  db.close();
}
