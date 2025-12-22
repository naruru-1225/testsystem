/**
 * すべてのマイグレーションを順番に実行する統合スクリプト
 *
 * 実行順序:
 * 1. folders テーブルの制約変更
 * 2. tests テーブルの外部キー修正
 * 3. test_folders テーブルの外部キー修正
 * 4. test_tags テーブルの外部キー修正
 * 5. test_attachments テーブルの外部キー修正
 */

import { execSync } from "child_process";
import path from "path";

console.log("=".repeat(60));
console.log("🚀 フォルダ制約変更マイグレーション - 統合実行スクリプト");
console.log("=".repeat(60));
console.log();

const migrations = [
  {
    step: 1,
    name: "folders テーブルの制約変更",
    script: "migrate-folder-unique-constraint.mjs",
  },
  {
    step: 2,
    name: "tests テーブルの外部キー修正",
    script: "fix-tests-foreign-key.mjs",
  },
  {
    step: 3,
    name: "test_folders テーブルの外部キー修正",
    script: "fix-test-folders-foreign-key.mjs",
  },
  {
    step: 4,
    name: "test_tags テーブルの外部キー修正",
    script: "fix-test-tags-foreign-key.mjs",
  },
  {
    step: 5,
    name: "test_attachments テーブルの外部キー修正",
    script: "fix-test-attachments-foreign-key.mjs",
  },
];

let allSuccess = true;

for (const migration of migrations) {
  console.log(`\n[ステップ ${migration.step}/5] ${migration.name}`);
  console.log("-".repeat(60));

  try {
    const scriptPath = path.join("scripts", "migration", migration.script);
    execSync(`node ${scriptPath}`, { stdio: "inherit" });
    console.log(`✅ ステップ ${migration.step} 完了\n`);
  } catch (error) {
    console.error(`❌ ステップ ${migration.step} でエラーが発生しました`);
    console.error(`   スクリプト: ${migration.script}`);
    console.error(`   エラー: ${error.message}`);
    allSuccess = false;
    break;
  }
}

console.log("\n" + "=".repeat(60));

if (allSuccess) {
  console.log("✅ すべてのマイグレーションが完了しました!");
  console.log("\n次のステップ:");
  console.log("  1. node scripts/migration/verify-migration.mjs     # マイグレーションの検証");
  console.log("  2. node scripts/tests/test-folder-uniqueness.mjs # 機能テスト");
  console.log("  3. npm run dev                    # アプリケーション起動");
} else {
  console.log("❌ マイグレーションに失敗しました");
  console.log("\nトラブルシューティング:");
  console.log("  - エラーメッセージを確認してください");
  console.log("  - データベースのバックアップから復元してください");
  console.log("  - 個別のマイグレーションスクリプトを確認してください");
  process.exit(1);
}

console.log("=".repeat(60));
