/**
 * tests_backupからtestsテーブルにデータを復元するスクリプト
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "tests.db");
const db = new Database(dbPath);

console.log("=".repeat(70));
console.log("🔄 テストデータの復元");
console.log("=".repeat(70));

try {
  // 1. バックアップの確認
  console.log("\n[1] バックアップデータの確認:");
  console.log("-".repeat(70));

  const backupExists = db
    .prepare(
      `
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='tests_backup'
  `
    )
    .get();

  if (!backupExists) {
    console.log("  ❌ tests_backup テーブルが見つかりません");
    console.log("     このスクリプトは使用できません");
    process.exit(1);
  }

  const backupCount = db
    .prepare("SELECT COUNT(*) as count FROM tests_backup")
    .get();
  console.log(`  ✅ tests_backup に ${backupCount.count}件のデータがあります`);

  if (backupCount.count === 0) {
    console.log("  ❌ バックアップにデータがありません");
    process.exit(1);
  }

  // 2. 現在のtestsテーブルの確認
  console.log("\n[2] 現在のtestsテーブル:");
  console.log("-".repeat(70));

  const currentCount = db.prepare("SELECT COUNT(*) as count FROM tests").get();
  console.log(`  現在のテスト数: ${currentCount.count}件`);

  if (currentCount.count > 0) {
    console.log(`  ⚠️  testsテーブルにすでにデータがあります`);
    console.log(`     復元すると現在のデータが失われます`);
    console.log(
      `\n  続行するには、スクリプトに --force フラグを追加してください:`
    );
    console.log(`  node restore-tests-from-backup.mjs --force`);

    if (!process.argv.includes("--force")) {
      process.exit(0);
    }
    console.log(`\n  --force フラグが指定されました。復元を続行します...`);
  }

  // 3. データの復元
  console.log("\n[3] データの復元:");
  console.log("-".repeat(70));

  db.pragma("foreign_keys = OFF");
  db.exec("BEGIN TRANSACTION");

  try {
    // 現在のデータを削除
    db.exec("DELETE FROM tests");
    console.log(`  🗑️  現在のデータを削除しました`);

    // バックアップからコピー
    db.exec(`
      INSERT INTO tests (id, name, subject, grade, folder_id, pdf_path, description, total_questions, total_score, created_at, updated_at)
      SELECT id, name, subject, grade, folder_id, pdf_path, description, total_questions, total_score, created_at, updated_at
      FROM tests_backup
    `);

    const restoredCount = db
      .prepare("SELECT COUNT(*) as count FROM tests")
      .get();
    console.log(`  ✅ ${restoredCount.count}件のテストを復元しました`);

    // バックアップテーブルを削除
    db.exec("DROP TABLE tests_backup");
    console.log(`  🗑️  tests_backup テーブルを削除しました`);

    db.exec("COMMIT");
    console.log(`  ✅ トランザクションをコミットしました`);
  } catch (error) {
    db.exec("ROLLBACK");
    console.log(`  ❌ エラーが発生したためロールバックしました`);
    throw error;
  } finally {
    db.pragma("foreign_keys = ON");
  }

  // 4. 復元結果の確認
  console.log("\n[4] 復元結果の確認:");
  console.log("-".repeat(70));

  const finalCount = db.prepare("SELECT COUNT(*) as count FROM tests").get();
  console.log(`  テスト数: ${finalCount.count}件`);

  // サンプルデータを表示
  const samples = db
    .prepare("SELECT id, name, subject, grade, folder_id FROM tests LIMIT 5")
    .all();
  console.log("\n  サンプルデータ:");
  samples.forEach((test) => {
    console.log(
      `    [${test.id}] ${test.name} (${test.subject} - ${test.grade}, フォルダID: ${test.folder_id})`
    );
  });

  console.log("\n" + "=".repeat(70));
  console.log("✅ 復元が完了しました!");
  console.log("=".repeat(70));
} catch (error) {
  console.error("\n❌ エラー:", error.message);
  console.error(error);
  process.exit(1);
} finally {
  db.close();
}
