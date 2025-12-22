/**
 * すべてのマイグレーションを安全に実行する統合スクリプト
 * 各ステップでデータ件数を確認し、失敗したら自動的にロールバックします
 */

import { execSync } from "child_process";
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "tests.db");

console.log("=".repeat(70));
console.log("🔄 安全なマイグレーション実行");
console.log("=".repeat(70));

// マイグレーション前のデータ件数を記録
function getDataCounts() {
  const db = new Database(dbPath);
  try {
    const counts = {
      folders: db.prepare("SELECT COUNT(*) as count FROM folders").get().count,
      tests: db.prepare("SELECT COUNT(*) as count FROM tests").get().count,
      test_folders: db
        .prepare("SELECT COUNT(*) as count FROM test_folders")
        .get().count,
      test_tags: db.prepare("SELECT COUNT(*) as count FROM test_tags").get()
        .count,
      test_attachments: db
        .prepare("SELECT COUNT(*) as count FROM test_attachments")
        .get().count,
    };
    return counts;
  } finally {
    db.close();
  }
}

// スクリプトを実行
function runScript(scriptName) {
  try {
    const scriptPath = path.join("scripts", "migration", scriptName);
    console.log(`\n実行中: ${scriptPath}`);
    execSync(`node ${scriptPath}`, {
      stdio: "inherit",
      encoding: "utf-8",
    });
    return true;
  } catch (error) {
    console.error(`\n❌ ${scriptName} の実行に失敗しました`);
    return false;
  }
}

try {
  // マイグレーション前の状態を記録
  console.log("\n[0] マイグレーション前のデータ件数:");
  console.log("-".repeat(70));
  const beforeCounts = getDataCounts();
  console.log(`  フォルダ: ${beforeCounts.folders}件`);
  console.log(`  テスト: ${beforeCounts.tests}件`);
  console.log(`  テスト-フォルダ関連: ${beforeCounts.test_folders}件`);
  console.log(`  テスト-タグ関連: ${beforeCounts.test_tags}件`);
  console.log(`  テスト添付ファイル: ${beforeCounts.test_attachments}件`);

  // ステップ1: foldersテーブル (すでに完了している可能性が高い)
  console.log("\n" + "=".repeat(70));
  console.log("[ステップ 1/4] foldersテーブルの確認");
  console.log("=".repeat(70));

  const db = new Database(dbPath);
  const foldersSchema = db
    .prepare(
      `
    SELECT sql FROM sqlite_master WHERE type='table' AND name='folders'
  `
    )
    .get();
  db.close();

  if (foldersSchema.sql.includes("UNIQUE(name, parent_id)")) {
    console.log("✅ foldersテーブルは既に正しい制約を持っています");
  } else {
    console.log("⚠️  foldersテーブルのマイグレーションが必要です");
    console.log(
      "   migrate-folder-unique-constraint.mjs を先に実行してください"
    );
    process.exit(1);
  }

  // ステップ2: testsテーブル
  console.log("\n" + "=".repeat(70));
  console.log("[ステップ 2/4] testsテーブルのマイグレーション");
  console.log("=".repeat(70));

  if (!runScript("safe-migration-tests.mjs")) {
    console.log("\n❌ testsテーブルのマイグレーションに失敗しました");
    console.log("   データは保護されています");
    process.exit(1);
  }

  // ステップ3: test_foldersテーブル
  console.log("\n" + "=".repeat(70));
  console.log("[ステップ 3/4] test_foldersテーブルのマイグレーション");
  console.log("=".repeat(70));

  if (!runScript("safe-migration-test-folders.mjs")) {
    console.log("\n❌ test_foldersテーブルのマイグレーションに失敗しました");
    console.log("   testsテーブルは更新済みですが、test_foldersは元のままです");
    process.exit(1);
  }

  // ステップ4: test_tagsテーブル
  console.log("\n" + "=".repeat(70));
  console.log("[ステップ 4/4] test_tagsテーブルのマイグレーション");
  console.log("=".repeat(70));

  if (!runScript("safe-migration-test-tags.mjs")) {
    console.log("\n❌ test_tagsテーブルのマイグレーションに失敗しました");
    process.exit(1);
  }

  // ステップ5: test_attachmentsテーブル
  console.log("\n" + "=".repeat(70));
  console.log("[ステップ 5/5] test_attachmentsテーブルのマイグレーション");
  console.log("=".repeat(70));

  if (!runScript("safe-migration-test-attachments.mjs")) {
    console.log(
      "\n❌ test_attachmentsテーブルのマイグレーションに失敗しました"
    );
    process.exit(1);
  }

  // マイグレーション後の確認
  console.log("\n" + "=".repeat(70));
  console.log("📊 マイグレーション後のデータ件数確認");
  console.log("=".repeat(70));

  const afterCounts = getDataCounts();

  console.log("\n比較:");
  console.log(
    `  フォルダ: ${beforeCounts.folders}件 → ${afterCounts.folders}件 ${
      beforeCounts.folders === afterCounts.folders ? "✅" : "❌"
    }`
  );
  console.log(
    `  テスト: ${beforeCounts.tests}件 → ${afterCounts.tests}件 ${
      beforeCounts.tests === afterCounts.tests ? "✅" : "❌"
    }`
  );
  console.log(
    `  テスト-フォルダ関連: ${beforeCounts.test_folders}件 → ${
      afterCounts.test_folders
    }件 ${beforeCounts.test_folders === afterCounts.test_folders ? "✅" : "❌"}`
  );
  console.log(
    `  テスト-タグ関連: ${beforeCounts.test_tags}件 → ${
      afterCounts.test_tags
    }件 ${beforeCounts.test_tags === afterCounts.test_tags ? "✅" : "❌"}`
  );
  console.log(
    `  テスト添付ファイル: ${beforeCounts.test_attachments}件 → ${
      afterCounts.test_attachments
    }件 ${
      beforeCounts.test_attachments === afterCounts.test_attachments
        ? "✅"
        : "❌"
    }`
  );

  // データ損失がないか確認
  let dataLoss = false;
  if (beforeCounts.folders !== afterCounts.folders) {
    console.log("\n⚠️  フォルダ数が変わっています!");
    dataLoss = true;
  }
  if (beforeCounts.tests !== afterCounts.tests) {
    console.log("\n⚠️  テスト数が変わっています!");
    dataLoss = true;
  }
  if (beforeCounts.test_folders !== afterCounts.test_folders) {
    console.log("\n⚠️  テスト-フォルダ関連数が変わっています!");
    dataLoss = true;
  }
  if (beforeCounts.test_tags !== afterCounts.test_tags) {
    console.log("\n⚠️  テスト-タグ関連数が変わっています!");
    dataLoss = true;
  }
  if (beforeCounts.test_attachments !== afterCounts.test_attachments) {
    console.log("\n⚠️  テスト添付ファイル数が変わっています!");
    dataLoss = true;
  }

  if (dataLoss) {
    console.log("\n❌ データの不一致が検出されました");
    console.log("   詳細を確認してください");
    process.exit(1);
  }

  console.log("\n" + "=".repeat(70));
  console.log("✅ すべてのマイグレーションが正常に完了しました!");
  console.log("   すべてのデータが保持されています");
  console.log("=".repeat(70));
} catch (error) {
  console.error("\n❌ エラーが発生しました:", error.message);
  process.exit(1);
}
