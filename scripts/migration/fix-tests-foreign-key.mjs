/**
 * testsテーブルの外部キー制約を修正するマイグレーションスクリプト
 *
 * 問題: testsテーブルのFOREIGN KEYが古い"folders_old"を参照している
 * 解決: testsテーブルを再作成して正しい"folders"を参照させる
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "tests.db");
const db = new Database(dbPath);

console.log("🔧 testsテーブルの外部キー制約を修正します...\n");

try {
  // 外部キー制約を一時的に無効化
  db.pragma("foreign_keys = OFF");

  // トランザクション開始
  db.exec("BEGIN TRANSACTION");

  // 1. 既存のtestsテーブルをバックアップ
  console.log("📝 既存のtestsテーブルをバックアップ...");
  db.exec("ALTER TABLE tests RENAME TO tests_backup");

  // 2. 新しいtestsテーブルを作成(正しい外部キー制約)
  console.log("📝 新しいtestsテーブルを作成...");
  db.exec(`
    CREATE TABLE tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      grade TEXT NOT NULL,
      folder_id INTEGER NOT NULL,
      pdf_path TEXT,
      description TEXT,
      total_questions INTEGER,
      total_score INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE
    )
  `);

  // 3. データを新しいテーブルにコピー
  console.log("📝 データを移行...");
  db.exec(`
    INSERT INTO tests (id, name, subject, grade, folder_id, pdf_path, description, total_questions, total_score, created_at, updated_at)
    SELECT id, name, subject, grade, folder_id, pdf_path, description, total_questions, total_score, created_at, updated_at
    FROM tests_backup
  `);

  // 4. コピーされたデータ数を確認
  const count = db.prepare("SELECT COUNT(*) as count FROM tests").get();
  console.log(`   移行されたテスト数: ${count.count}件`);

  // 5. AUTOINCREMENTのシーケンスを更新
  const maxId = db.prepare("SELECT MAX(id) as max FROM tests").get();
  if (maxId && maxId.max) {
    db.exec(`
      INSERT OR REPLACE INTO sqlite_sequence (name, seq) 
      VALUES ('tests', ${maxId.max})
    `);
  }

  // 6. インデックスを再作成
  console.log("📝 インデックスを再作成...");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tests_folder_id ON tests(folder_id);
    CREATE INDEX IF NOT EXISTS idx_tests_subject ON tests(subject);
    CREATE INDEX IF NOT EXISTS idx_tests_grade ON tests(grade);
  `);

  // 7. バックアップテーブルを削除
  console.log("📝 バックアップテーブルを削除...");
  db.exec("DROP TABLE tests_backup");

  // コミット
  db.exec("COMMIT");

  // 外部キー制約を再度有効化
  db.pragma("foreign_keys = ON");

  console.log("✅ マイグレーション完了!\n");

  // 8. 確認
  console.log("📊 修正後の構造確認:");
  const schema = db
    .prepare(
      `
    SELECT sql FROM sqlite_master 
    WHERE type='table' AND name='tests'
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
