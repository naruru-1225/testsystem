/**
 * マイグレーションスクリプトの動作テスト
 * わざと古い状態のテーブルを作成して、マイグレーションが正しく動作するか確認
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const testDbPath = path.join(process.cwd(), "data", "test_migration.db");

console.log("=".repeat(70));
console.log("🧪 マイグレーションスクリプトの動作テスト");
console.log("=".repeat(70));

// 既存のテストDBを削除
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
  console.log("既存のテストDBを削除しました");
}

const db = new Database(testDbPath);

try {
  // 外部キーチェックを無効化（存在しないテーブルへの参照を許可）
  db.pragma("foreign_keys = OFF");

  console.log("\n[1] テスト用データベースの作成:");
  console.log("-".repeat(70));

  // 古い状態のfoldersテーブルを作成（folders_oldを参照するテーブル用）
  db.exec(`
    CREATE TABLE folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, parent_id)
    )
  `);
  console.log("  ✅ foldersテーブル作成");

  // foldersにテストデータを挿入
  db.exec(`
    INSERT INTO folders (id, name, parent_id) VALUES
    (1, 'ルートフォルダ1', NULL),
    (2, 'サブフォルダ1', 1),
    (3, 'サブフォルダ2', 1)
  `);
  console.log("  ✅ 3件のフォルダを作成");

  // 古い状態のtestsテーブル（folders_oldを参照）
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
      FOREIGN KEY (folder_id) REFERENCES "folders_old" (id) ON DELETE CASCADE
    )
  `);
  console.log("  ✅ testsテーブル作成（folders_oldを参照）");

  // testsにテストデータを挿入
  db.exec(`
    INSERT INTO tests (id, name, subject, grade, folder_id, pdf_path, description, total_questions, total_score) VALUES
    (1, 'テスト1', '数学', '中1', 1, '/uploads/test1.pdf', '説明1', 10, 100),
    (2, 'テスト2', '英語', '中2', 2, '/uploads/test2.pdf', '説明2', 15, 150),
    (3, 'テスト3', '理科', '中3', 3, '/uploads/test3.pdf', '説明3', 20, 200)
  `);
  console.log("  ✅ 3件のテストを作成");

  // tagsテーブル
  db.exec(`
    CREATE TABLE tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`
    INSERT INTO tags (id, name) VALUES
    (1, '重要'),
    (2, '復習')
  `);
  console.log("  ✅ tagsテーブル作成");

  // 古い状態のtest_foldersテーブル
  db.exec(`
    CREATE TABLE test_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL,
      folder_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (test_id) REFERENCES "tests_backup" (id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES "folders_old" (id) ON DELETE CASCADE
    )
  `);
  db.exec(`
    INSERT INTO test_folders (test_id, folder_id) VALUES
    (1, 1),
    (2, 2),
    (3, 3)
  `);
  console.log("  ✅ test_foldersテーブル作成（古い参照）");

  // 古い状態のtest_tagsテーブル
  db.exec(`
    CREATE TABLE test_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (test_id) REFERENCES "tests_backup" (id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
    )
  `);
  db.exec(`
    INSERT INTO test_tags (test_id, tag_id) VALUES
    (1, 1),
    (2, 2)
  `);
  console.log("  ✅ test_tagsテーブル作成（古い参照）");

  // 古い状態のtest_attachmentsテーブル
  db.exec(`
    CREATE TABLE test_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (test_id) REFERENCES "tests_backup" (id) ON DELETE CASCADE
    )
  `);
  console.log("  ✅ test_attachmentsテーブル作成（古い参照）");

  // 2. 作成したデータの確認
  console.log("\n[2] 作成したテストデータ:");
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

  console.log(`  folders: ${counts.folders}件`);
  console.log(`  tests: ${counts.tests}件`);
  console.log(`  test_folders: ${counts.test_folders}件`);
  console.log(`  test_tags: ${counts.test_tags}件`);
  console.log(`  test_attachments: ${counts.test_attachments}件`);

  // 3. 外部キー参照の確認
  console.log("\n[3] 外部キー参照の確認:");
  console.log("-".repeat(70));

  const testsSchema = db
    .prepare(
      `
    SELECT sql FROM sqlite_master WHERE type='table' AND name='tests'
  `
    )
    .get();

  if (testsSchema.sql.includes("folders_old")) {
    console.log(
      "  ✅ tests: folders_old への参照を確認（マイグレーション対象）"
    );
  }

  const testFoldersSchema = db
    .prepare(
      `
    SELECT sql FROM sqlite_master WHERE type='table' AND name='test_folders'
  `
    )
    .get();

  if (testFoldersSchema.sql.includes("tests_backup")) {
    console.log(
      "  ✅ test_folders: tests_backup への参照を確認（マイグレーション対象）"
    );
  }
  if (testFoldersSchema.sql.includes("folders_old")) {
    console.log(
      "  ✅ test_folders: folders_old への参照を確認（マイグレーション対象）"
    );
  }

  db.close();

  console.log("\n" + "=".repeat(70));
  console.log("✅ テスト用データベースの準備完了");
  console.log("=".repeat(70));
  console.log(`\nテストDB: ${testDbPath}`);
  console.log("\n次のステップ:");
  console.log("1. data/tests.db を一時的にリネーム");
  console.log("2. test_migration.db を tests.db にコピー");
  console.log("3. マイグレーションスクリプトを実行");
  console.log("4. 元のtests.dbを戻す");

  console.log("\n実行コマンド:");
  console.log("Move-Item data\\tests.db data\\tests_original.db");
  console.log("Copy-Item data\\test_migration.db data\\tests.db");
  console.log("node run-safe-migrations.mjs");
  console.log("Remove-Item data\\tests.db");
  console.log("Move-Item data\\tests_original.db data\\tests.db");
  console.log("Remove-Item data\\test_migration.db");
} catch (error) {
  console.error("\n❌ エラー:", error.message);
  console.error(error);
  db.close();
  process.exit(1);
}
