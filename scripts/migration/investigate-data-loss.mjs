/**
 * 本番環境でテストが消えた原因を調査するスクリプト
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "tests.db");
const db = new Database(dbPath);

console.log("=".repeat(70));
console.log("🔍 テストデータ消失の原因調査");
console.log("=".repeat(70));

try {
  // 1. 現在のテスト件数
  console.log("\n[1] 現在のテスト件数:");
  console.log("-".repeat(70));

  const testCount = db.prepare("SELECT COUNT(*) as count FROM tests").get();
  console.log(`  テスト数: ${testCount.count}件`);

  if (testCount.count === 0) {
    console.log("  ❌ テストがすべて消えています!");
  }

  // 2. バックアップテーブルの確認
  console.log("\n[2] バックアップテーブルの確認:");
  console.log("-".repeat(70));

  const backupTables = db
    .prepare(
      `
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    AND name LIKE '%backup%'
    ORDER BY name
  `
    )
    .all();

  if (backupTables.length === 0) {
    console.log("  ⚠️  バックアップテーブルが見つかりません");
    console.log(
      "     マイグレーションは完了していますが、データは消えています"
    );
  } else {
    console.log(`  見つかったバックアップテーブル:`);
    backupTables.forEach((table) => {
      const count = db
        .prepare(`SELECT COUNT(*) as count FROM ${table.name}`)
        .get();
      console.log(`    - ${table.name}: ${count.count}件`);

      if (table.name === "tests_backup" && count.count > 0) {
        console.log(
          `\n  ✅ tests_backup に ${count.count}件のデータがあります!`
        );
        console.log(`     これを復元できます!`);
      }
    });
  }

  // 3. すべてのテーブル一覧
  console.log("\n[3] データベース内のすべてのテーブル:");
  console.log("-".repeat(70));

  const allTables = db
    .prepare(
      `
    SELECT name, type FROM sqlite_master 
    WHERE type='table' 
    AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `
    )
    .all();

  allTables.forEach((table) => {
    try {
      const count = db
        .prepare(`SELECT COUNT(*) as count FROM ${table.name}`)
        .get();
      console.log(`  - ${table.name}: ${count.count}件`);
    } catch (e) {
      console.log(`  - ${table.name}: エラー`);
    }
  });

  // 4. 復元可能なデータの確認
  console.log("\n[4] 復元可能なデータ:");
  console.log("-".repeat(70));

  let canRestore = false;
  let restoreSource = null;
  let restoreCount = 0;

  // tests_backupをチェック
  const testsBackupExists = allTables.find((t) => t.name === "tests_backup");
  if (testsBackupExists) {
    const backupCount = db
      .prepare("SELECT COUNT(*) as count FROM tests_backup")
      .get();
    if (backupCount.count > 0) {
      canRestore = true;
      restoreSource = "tests_backup";
      restoreCount = backupCount.count;

      console.log(
        `  ✅ tests_backup から ${restoreCount}件のテストを復元できます!`
      );

      // サンプルデータを表示
      const samples = db
        .prepare("SELECT id, name, folder_id FROM tests_backup LIMIT 5")
        .all();
      console.log("\n  サンプル:");
      samples.forEach((test) => {
        console.log(
          `    [${test.id}] ${test.name} (フォルダID: ${test.folder_id})`
        );
      });
    }
  }

  if (!canRestore) {
    console.log("  ❌ 復元可能なデータが見つかりません");
    console.log("     バックアップファイルから復元する必要があります");
  }

  // 5. 復元手順の提示
  if (canRestore) {
    console.log("\n" + "=".repeat(70));
    console.log("🔧 復元手順:");
    console.log("=".repeat(70));
    console.log(`\n以下のスクリプトを実行してデータを復元してください:\n`);
    console.log(`node restore-tests-from-backup.mjs\n`);
  } else {
    console.log("\n" + "=".repeat(70));
    console.log("💾 バックアップからの復元が必要:");
    console.log("=".repeat(70));
    console.log(`\nバックアップフォルダから tests.db を復元してください:\n`);
    console.log(`Remove-Item data\\tests.db`);
    console.log(
      `Copy-Item data_backup_YYYYMMDD_HHMMSS\\tests.db data\\tests.db\n`
    );
  }

  console.log("=".repeat(70));
} catch (error) {
  console.error("\n❌ エラー:", error.message);
  console.error(error);
} finally {
  db.close();
}
