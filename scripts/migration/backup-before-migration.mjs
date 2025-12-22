/**
 * マイグレーション前の完全バックアップと検証スクリプト
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbPath = path.join(process.cwd(), "data", "tests.db");
const db = new Database(dbPath);

console.log("=".repeat(70));
console.log("🔍 マイグレーション前のデータ確認");
console.log("=".repeat(70));

try {
  // 1. 現在のデータ件数
  console.log("\n[1] 現在のデータ件数:");
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
    tags: db.prepare("SELECT COUNT(*) as count FROM tags").get().count,
  };

  console.log(`  フォルダ: ${counts.folders}件`);
  console.log(`  テスト: ${counts.tests}件`);
  console.log(`  test_folders: ${counts.test_folders}件`);
  console.log(`  test_tags: ${counts.test_tags}件`);
  console.log(`  test_attachments: ${counts.test_attachments}件`);
  console.log(`  タグ: ${counts.tags}件`);

  // 2. テストの詳細情報
  if (counts.tests > 0) {
    console.log("\n[2] テストの詳細(最初の10件):");
    console.log("-".repeat(70));

    const tests = db
      .prepare(
        `
      SELECT 
        t.id,
        t.name,
        t.folder_id,
        f.name as folder_name
      FROM tests t
      LEFT JOIN folders f ON t.folder_id = f.id
      ORDER BY t.id
      LIMIT 10
    `
      )
      .all();

    tests.forEach((test) => {
      const folderInfo = test.folder_name
        ? `フォルダ: ${test.folder_name}`
        : `フォルダID: ${test.folder_id} (存在しない!)`;
      console.log(`  [${test.id}] ${test.name} - ${folderInfo}`);
    });

    if (counts.tests > 10) {
      console.log(`  ... 他 ${counts.tests - 10}件`);
    }
  }

  // 3. 孤立したテストのチェック
  console.log("\n[3] 孤立したテスト(存在しないフォルダを参照):");
  console.log("-".repeat(70));

  const orphanedTests = db
    .prepare(
      `
    SELECT 
      t.id,
      t.name,
      t.folder_id
    FROM tests t
    LEFT JOIN folders f ON t.folder_id = f.id
    WHERE f.id IS NULL
  `
    )
    .all();

  if (orphanedTests.length === 0) {
    console.log("  ✅ 孤立したテストはありません");
  } else {
    console.log(`  ⚠️  ${orphanedTests.length}件の孤立したテストがあります:`);
    orphanedTests.forEach((test) => {
      console.log(
        `    [${test.id}] ${test.name} - フォルダID: ${test.folder_id} (存在しない)`
      );
    });
    console.log(
      "\n  ⚠️  警告: これらのテストは外部キー制約が有効な場合、削除される可能性があります!"
    );
  }

  // 4. テーブル構造の確認
  console.log("\n[4] testsテーブルの構造:");
  console.log("-".repeat(70));

  const testsSchema = db
    .prepare(
      `
    SELECT sql FROM sqlite_master WHERE type='table' AND name='tests'
  `
    )
    .get();

  if (testsSchema) {
    console.log(testsSchema.sql);
  }

  // 5. 外部キー制約の現在の状態
  console.log("\n[5] 外部キー制約の状態:");
  console.log("-".repeat(70));

  const fkStatus = db.pragma("foreign_keys");
  console.log(`  外部キー制約: ${fkStatus ? "ON" : "OFF"}`);

  // 6. バックアップの作成を推奨
  console.log("\n" + "=".repeat(70));
  console.log("💾 バックアップの推奨:");
  console.log("=".repeat(70));

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const backupName = `data_backup_${timestamp}`;

  console.log(`\n以下のコマンドでバックアップを作成してください:`);
  console.log(
    `\nCopy-Item -Path "data" -Destination "${backupName}" -Recurse\n`
  );

  // 7. データをJSONにエクスポート(追加の安全策)
  console.log("\n[6] データのJSONエクスポート:");
  console.log("-".repeat(70));

  const exportData = {
    timestamp: new Date().toISOString(),
    counts: counts,
    tests: db.prepare("SELECT * FROM tests").all(),
    folders: db.prepare("SELECT * FROM folders").all(),
    test_folders: db.prepare("SELECT * FROM test_folders").all(),
    test_tags: db.prepare("SELECT * FROM test_tags").all(),
    test_attachments: db.prepare("SELECT * FROM test_attachments").all(),
    tags: db.prepare("SELECT * FROM tags").all(),
  };

  const exportPath = path.join(
    process.cwd(),
    `database_export_${timestamp}.json`
  );
  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), "utf-8");

  console.log(`  ✅ データをエクスポートしました: ${exportPath}`);
  console.log(`     このファイルがあれば、万が一の場合にデータを復元できます`);

  console.log("\n" + "=".repeat(70));
  console.log("✅ 確認完了");
  console.log("=".repeat(70));

  if (orphanedTests.length > 0) {
    console.log("\n⚠️  警告: 孤立したテストがあります!");
    console.log(
      "   マイグレーションを実行する前に、これらのテストのフォルダIDを修正してください。"
    );
    console.log(
      "   または、これらのテストが削除されることを承知の上で実行してください。"
    );
  } else {
    console.log(
      "\n✅ すべてのデータが正常です。マイグレーションを安全に実行できます。"
    );
  }
} catch (error) {
  console.error("\n❌ エラー:", error.message);
  process.exit(1);
} finally {
  db.close();
}
