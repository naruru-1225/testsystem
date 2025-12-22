/**
 * 本番環境の現在のデータベース状態を確認するスクリプト
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "tests.db");
const db = new Database(dbPath);

console.log("=".repeat(60));
console.log("📊 データベース状態チェック");
console.log("=".repeat(60));

// 1. foldersテーブルの構造確認
console.log("\n[1] folders テーブル:");
const foldersSchema = db
  .prepare(
    `
  SELECT sql FROM sqlite_master WHERE name='folders'
`
  )
  .get();

if (foldersSchema) {
  const hasOldConstraint = foldersSchema.sql.includes(
    "name TEXT NOT NULL UNIQUE"
  );
  const hasNewConstraint = foldersSchema.sql.includes(
    "UNIQUE(name, parent_id)"
  );

  if (hasNewConstraint) {
    console.log("  ✅ 新しい制約 UNIQUE(name, parent_id) が設定済み");
    console.log("  → ステップ1完了済み");
  } else if (hasOldConstraint) {
    console.log("  ⚠️  古い制約 UNIQUE(name) のまま");
    console.log("  → ステップ1が必要です");
  } else {
    console.log("  ❓ 制約が不明");
  }
} else {
  console.log("  ❌ foldersテーブルが存在しません");
}

// 2. testsテーブルの外部キー確認
console.log("\n[2] tests テーブル:");
const testsSchema = db
  .prepare(
    `
  SELECT sql FROM sqlite_master WHERE name='tests'
`
  )
  .get();

if (testsSchema) {
  const hasFoldersOld = testsSchema.sql.includes("folders_old");
  const hasFolders =
    testsSchema.sql.includes("REFERENCES folders") && !hasFoldersOld;

  if (hasFolders) {
    console.log("  ✅ 正しい参照 REFERENCES folders");
    console.log("  → ステップ2完了済み");
  } else if (hasFoldersOld) {
    console.log("  ⚠️  古い参照 folders_old");
    console.log("  → ステップ2が必要です");
  }
} else {
  console.log("  ❌ testsテーブルが存在しません");
}

// 3. test_foldersテーブルの外部キー確認
console.log("\n[3] test_folders テーブル:");
const testFoldersSchema = db
  .prepare(
    `
  SELECT sql FROM sqlite_master WHERE name='test_folders'
`
  )
  .get();

if (testFoldersSchema) {
  const hasTestsBackup = testFoldersSchema.sql.includes("tests_backup");
  const hasFoldersOld = testFoldersSchema.sql.includes("folders_old");

  if (!hasTestsBackup && !hasFoldersOld) {
    console.log("  ✅ 正しい参照");
    console.log("  → ステップ3完了済み");
  } else {
    if (hasTestsBackup) console.log("  ⚠️  古い参照 tests_backup");
    if (hasFoldersOld) console.log("  ⚠️  古い参照 folders_old");
    console.log("  → ステップ3が必要です");
  }
}

// 4. test_tagsテーブルの外部キー確認
console.log("\n[4] test_tags テーブル:");
const testTagsSchema = db
  .prepare(
    `
  SELECT sql FROM sqlite_master WHERE name='test_tags'
`
  )
  .get();

if (testTagsSchema) {
  const hasTestsBackup = testTagsSchema.sql.includes("tests_backup");

  if (!hasTestsBackup) {
    console.log("  ✅ 正しい参照");
    console.log("  → ステップ4完了済み");
  } else {
    console.log("  ⚠️  古い参照 tests_backup");
    console.log("  → ステップ4が必要です");
  }
}

// 5. test_attachmentsテーブルの外部キー確認
console.log("\n[5] test_attachments テーブル:");
const testAttachmentsSchema = db
  .prepare(
    `
  SELECT sql FROM sqlite_master WHERE name='test_attachments'
`
  )
  .get();

if (testAttachmentsSchema) {
  const hasTestsBackup = testAttachmentsSchema.sql.includes("tests_backup");

  if (!hasTestsBackup) {
    console.log("  ✅ 正しい参照");
    console.log("  → ステップ5完了済み");
  } else {
    console.log("  ⚠️  古い参照 tests_backup");
    console.log("  → ステップ5が必要です");
  }
}

// 6. データ件数確認
console.log("\n" + "=".repeat(60));
console.log("📈 データ件数:");
const folderCount = db.prepare("SELECT COUNT(*) as count FROM folders").get();
const testCount = db.prepare("SELECT COUNT(*) as count FROM tests").get();
console.log(`  フォルダ数: ${folderCount.count}件`);
console.log(`  テスト数: ${testCount.count}件`);

console.log("\n" + "=".repeat(60));
console.log("\n💡 次に実行すべきステップ:");

// 状態判定
const needsStep1 =
  foldersSchema && !foldersSchema.sql.includes("UNIQUE(name, parent_id)");
const needsStep2 = testsSchema && testsSchema.sql.includes("folders_old");
const needsStep3 =
  testFoldersSchema &&
  (testFoldersSchema.sql.includes("tests_backup") ||
    testFoldersSchema.sql.includes("folders_old"));
const needsStep4 =
  testTagsSchema && testTagsSchema.sql.includes("tests_backup");
const needsStep5 =
  testAttachmentsSchema && testAttachmentsSchema.sql.includes("tests_backup");

if (needsStep1) {
  console.log("  1️⃣  node migrate-folder-unique-constraint.mjs");
}
if (needsStep2) {
  console.log("  2️⃣  node fix-tests-foreign-key.mjs");
}
if (needsStep3) {
  console.log("  3️⃣  node fix-test-folders-foreign-key.mjs");
}
if (needsStep4) {
  console.log("  4️⃣  node fix-test-tags-foreign-key.mjs");
}
if (needsStep5) {
  console.log("  5️⃣  node fix-test-attachments-foreign-key.mjs");
}

if (!needsStep1 && !needsStep2 && !needsStep3 && !needsStep4 && !needsStep5) {
  console.log("  ✅ すべて完了しています!");
}

console.log("\n" + "=".repeat(60));

db.close();
