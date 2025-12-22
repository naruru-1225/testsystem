/**
 * データベース整合性チェックスクリプト
 * SQLiteデータベースの内容を直接確認します
 */

import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(dirname(__filename), "../..");

const dbPath = join(__dirname, "data", "tests.db");

console.log("=".repeat(50));
console.log("📊 データベース整合性チェック");
console.log("=".repeat(50));
console.log(`データベース: ${dbPath}\n`);

try {
  const db = new Database(dbPath, { readonly: true });

  // 1. 学年データのチェック
  console.log("\n[1] 学年マスタデータ");
  console.log("-".repeat(50));
  const grades = db
    .prepare("SELECT * FROM grades ORDER BY display_order, name")
    .all();
  console.log(`件数: ${grades.length}件`);
  if (grades.length > 0) {
    console.log("データサンプル:");
    grades.slice(0, 5).forEach((g) => {
      console.log(`  - ${g.name} (ID: ${g.id}, 表示順: ${g.display_order})`);
    });
  }

  // 2. 科目データのチェック
  console.log("\n[2] 科目マスタデータ");
  console.log("-".repeat(50));
  const subjects = db
    .prepare("SELECT * FROM subjects ORDER BY display_order, name")
    .all();
  console.log(`件数: ${subjects.length}件`);
  if (subjects.length > 0) {
    console.log("データサンプル:");
    subjects.slice(0, 5).forEach((s) => {
      console.log(`  - ${s.name} (ID: ${s.id}, 表示順: ${s.display_order})`);
    });
  }

  // 3. タグデータのチェック
  console.log("\n[3] タグデータ");
  console.log("-".repeat(50));
  const tags = db.prepare("SELECT * FROM tags ORDER BY name").all();
  console.log(`件数: ${tags.length}件`);
  if (tags.length > 0) {
    console.log("データサンプル:");
    tags.slice(0, 5).forEach((t) => {
      console.log(`  - ${t.name} (ID: ${t.id}, 色: ${t.color})`);
    });
  }

  // 4. フォルダデータのチェック
  console.log("\n[4] フォルダデータ");
  console.log("-".repeat(50));
  const folders = db.prepare("SELECT * FROM folders ORDER BY name").all();
  console.log(`件数: ${folders.length}件`);
  if (folders.length > 0) {
    console.log("データサンプル:");
    folders.slice(0, 5).forEach((f) => {
      console.log(
        `  - ${f.name} (ID: ${f.id}, 親ID: ${f.parent_id || "なし"})`
      );
    });
  }

  // 5. テストデータのチェック
  console.log("\n[5] テストデータ");
  console.log("-".repeat(50));
  const tests = db
    .prepare("SELECT * FROM tests ORDER BY created_at DESC")
    .all();
  console.log(`件数: ${tests.length}件`);
  if (tests.length > 0) {
    console.log("データサンプル:");
    tests.slice(0, 3).forEach((t) => {
      console.log(`  - ${t.name}`);
      console.log(`    学年: ${t.grade}, 科目: ${t.subject}`);
      console.log(`    フォルダID: ${t.folder_id}`);

      // このテストに紐づくタグを取得
      const testTags = db
        .prepare(
          `
        SELECT tg.name 
        FROM tags tg
        INNER JOIN test_tags tt ON tg.id = tt.tag_id
        WHERE tt.test_id = ?
      `
        )
        .all(t.id);
      console.log(
        `    タグ: ${testTags.map((tag) => tag.name).join(", ") || "なし"}`
      );
    });
  }

  // 6. テスト-フォルダ関連のチェック
  console.log("\n[6] テスト-フォルダ関連");
  console.log("-".repeat(50));
  const testFolders = db
    .prepare("SELECT COUNT(*) as count FROM test_folders")
    .get();
  console.log(`関連数: ${testFolders.count}件`);

  // 7. テスト-タグ関連のチェック
  console.log("\n[7] テスト-タグ関連");
  console.log("-".repeat(50));
  const testTags = db.prepare("SELECT COUNT(*) as count FROM test_tags").get();
  console.log(`関連数: ${testTags.count}件`);

  // 8. 添付ファイルのチェック
  console.log("\n[8] 添付ファイル");
  console.log("-".repeat(50));
  const attachments = db
    .prepare("SELECT COUNT(*) as count FROM test_attachments")
    .get();
  console.log(`件数: ${attachments.count}件`);

  // 9. データ整合性チェック
  console.log("\n[9] データ整合性チェック");
  console.log("-".repeat(50));

  // folder_idがNULLのテストがないかチェック
  const nullFolderTests = db
    .prepare("SELECT COUNT(*) as count FROM tests WHERE folder_id IS NULL")
    .get();
  console.log(
    `folder_idがNULLのテスト: ${nullFolderTests.count}件 ${
      nullFolderTests.count > 0 ? "⚠️" : "✓"
    }`
  );

  // test_foldersに関連がないテストをチェック
  const orphanTests = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM tests t
    WHERE NOT EXISTS (SELECT 1 FROM test_folders tf WHERE tf.test_id = t.id)
  `
    )
    .get();
  console.log(
    `test_foldersに関連がないテスト: ${orphanTests.count}件 ${
      orphanTests.count > 0 ? "⚠️" : "✓"
    }`
  );

  // 存在しないfolder_idを参照しているテスト
  const invalidFolderTests = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM tests t
    WHERE NOT EXISTS (SELECT 1 FROM folders f WHERE f.id = t.folder_id)
  `
    )
    .get();
  console.log(
    `存在しないフォルダを参照: ${invalidFolderTests.count}件 ${
      invalidFolderTests.count > 0 ? "❌" : "✓"
    }`
  );

  // 10. テーブル構造のチェック
  console.log("\n[10] テーブル構造");
  console.log("-".repeat(50));
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all();
  console.log("テーブル一覧:");
  tables.forEach((t) => {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${t.name}`).get();
    console.log(`  - ${t.name}: ${count.count}件`);
  });

  db.close();

  console.log("\n" + "=".repeat(50));
  console.log("✓ チェック完了");
  console.log("=".repeat(50));
} catch (error) {
  console.error("❌ エラー:", error.message);
  console.error(error);
  process.exit(1);
}
