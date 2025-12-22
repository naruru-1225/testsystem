/**
 * 安全なtestsテーブルのマイグレーション
 * データを失わないように、各ステップで検証を行います
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "tests.db");
const db = new Database(dbPath);

console.log("=".repeat(70));
console.log("🔄 testsテーブルの安全なマイグレーション");
console.log("=".repeat(70));

try {
  // 1. マイグレーション前の状態確認
  console.log("\n[1] マイグレーション前の状態確認:");
  console.log("-".repeat(70));

  // testsテーブルの存在確認
  const testsExists = db
    .prepare(
      `
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='tests'
  `
    )
    .get();

  if (!testsExists) {
    console.log("  ❌ testsテーブルが見つかりません");
    process.exit(1);
  }

  // 現在のテスト件数
  const beforeCount = db.prepare("SELECT COUNT(*) as count FROM tests").get();
  console.log(`  現在のテスト数: ${beforeCount.count}件`);

  if (beforeCount.count === 0) {
    console.log("  ⚠️  テストデータがありません");
    console.log(
      "     マイグレーションを続行しますか? (続行する場合は --force フラグを追加)"
    );
    if (!process.argv.includes("--force")) {
      process.exit(0);
    }
  }

  // サンプルデータを表示
  const samples = db
    .prepare("SELECT id, name, folder_id FROM tests LIMIT 3")
    .all();
  console.log("\n  サンプルデータ:");
  samples.forEach((test) => {
    console.log(
      `    [${test.id}] ${test.name} (フォルダID: ${test.folder_id})`
    );
  });

  // 現在のテーブル構造を確認
  const currentSchema = db
    .prepare(
      `
    SELECT sql FROM sqlite_master 
    WHERE type='table' AND name='tests'
  `
    )
    .get();

  console.log("\n  現在のテーブル構造:");
  console.log(`    ${currentSchema.sql.substring(0, 100)}...`);

  // folders_oldへの参照があるか確認
  if (currentSchema.sql.includes("folders_old")) {
    console.log(
      "  ⚠️  folders_old への参照が見つかりました - マイグレーションが必要です"
    );
  } else if (
    currentSchema.sql.includes('REFERENCES "folders"') ||
    currentSchema.sql.includes("REFERENCES folders")
  ) {
    console.log("  ✅ すでに folders への参照に修正されています");
    console.log("     このマイグレーションは不要です");
    process.exit(0);
  }

  // 2. マイグレーションの実行
  console.log("\n[2] マイグレーションの実行:");
  console.log("-".repeat(70));

  db.pragma("foreign_keys = OFF");
  db.exec("BEGIN TRANSACTION");

  try {
    // Step 1: testsテーブルをリネーム
    console.log("  📝 testsテーブルを tests_backup にリネーム...");
    db.exec("ALTER TABLE tests RENAME TO tests_backup");

    // Step 2: 新しいtestsテーブルを作成
    console.log("  📝 新しいtestsテーブルを作成...");
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

    // Step 3: データをコピー
    console.log("  📝 データをコピー中...");
    db.exec(`
      INSERT INTO tests (id, name, subject, grade, folder_id, pdf_path, description, total_questions, total_score, created_at, updated_at)
      SELECT id, name, subject, grade, folder_id, pdf_path, description, total_questions, total_score, created_at, updated_at
      FROM tests_backup
    `);

    // Step 4: コピー後の件数確認
    const afterCount = db.prepare("SELECT COUNT(*) as count FROM tests").get();
    console.log(`  📊 コピー前: ${beforeCount.count}件`);
    console.log(`  📊 コピー後: ${afterCount.count}件`);

    // 件数が一致しない場合はロールバック
    if (beforeCount.count !== afterCount.count) {
      console.log(`  ❌ データ件数が一致しません!`);
      console.log(`     マイグレーションを中止してロールバックします`);
      throw new Error(
        `データ件数の不一致: ${beforeCount.count} → ${afterCount.count}`
      );
    }

    console.log(`  ✅ すべてのデータが正常にコピーされました`);

    // Step 5: サンプルデータで内容確認
    console.log("\n  📋 コピー後のサンプルデータ:");
    const afterSamples = db
      .prepare("SELECT id, name, folder_id FROM tests LIMIT 3")
      .all();
    afterSamples.forEach((test) => {
      console.log(
        `    [${test.id}] ${test.name} (フォルダID: ${test.folder_id})`
      );
    });

    // Step 6: バックアップテーブルを削除
    console.log("\n  🗑️  バックアップテーブルを削除...");
    db.exec("DROP TABLE tests_backup");

    // コミット
    db.exec("COMMIT");
    console.log("  ✅ トランザクションをコミットしました");
  } catch (error) {
    console.log("\n  ❌ エラーが発生しました:");
    console.log(`     ${error.message}`);
    console.log("\n  🔄 ロールバック中...");
    db.exec("ROLLBACK");
    console.log("  ✅ ロールバック完了 - データは保護されています");
    throw error;
  } finally {
    db.pragma("foreign_keys = ON");
  }

  // 3. マイグレーション後の確認
  console.log("\n[3] マイグレーション後の確認:");
  console.log("-".repeat(70));

  const finalCount = db.prepare("SELECT COUNT(*) as count FROM tests").get();
  console.log(`  最終テスト数: ${finalCount.count}件`);

  // テーブル構造の確認
  const newSchema = db
    .prepare(
      `
    SELECT sql FROM sqlite_master 
    WHERE type='table' AND name='tests'
  `
    )
    .get();

  if (newSchema.sql.includes("REFERENCES folders")) {
    console.log("  ✅ 外部キーが正しく folders を参照しています");
  }

  console.log("\n" + "=".repeat(70));
  console.log("✅ マイグレーションが正常に完了しました!");
  console.log(`   ${finalCount.count}件のテストデータはすべて保持されています`);
  console.log("=".repeat(70));
} catch (error) {
  console.error("\n❌ マイグレーション失敗:", error.message);
  console.error("\nデータは元の状態で保護されています");
  process.exit(1);
} finally {
  db.close();
}
