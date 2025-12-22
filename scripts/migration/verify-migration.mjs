/**
 * すべてのマイグレーションが正しく適用されたかを検証するスクリプト
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "tests.db");
const db = new Database(dbPath);

console.log("✅ マイグレーション検証スクリプト\n");
console.log("=".repeat(50));

let allPassed = true;

// テスト1: folders_oldへの参照がないことを確認
console.log("\n[テスト1] folders_oldへの参照チェック");
const oldRefs = db
  .prepare(
    `
  SELECT name, type, sql FROM sqlite_master 
  WHERE sql LIKE '%folders_old%' OR sql LIKE '%tests_backup%'
`
  )
  .all();

if (oldRefs.length === 0) {
  console.log("  ✅ 古いテーブルへの参照なし");
} else {
  console.log("  ❌ 古いテーブルへの参照が見つかりました:");
  oldRefs.forEach((ref) => {
    console.log(`     - ${ref.type}: ${ref.name}`);
  });
  allPassed = false;
}

// テスト2: foldersテーブルの制約確認
console.log("\n[テスト2] foldersテーブルの制約確認");
const foldersSchema = db
  .prepare(
    `
  SELECT sql FROM sqlite_master WHERE type='table' AND name='folders'
`
  )
  .get();

if (foldersSchema && foldersSchema.sql.includes("UNIQUE(name, parent_id)")) {
  console.log("  ✅ UNIQUE(name, parent_id)制約あり");
} else {
  console.log("  ❌ UNIQUE(name, parent_id)制約なし");
  allPassed = false;
}

// テスト3: testsテーブルの外部キー確認
console.log("\n[テスト3] testsテーブルの外部キー確認");
const testsSchema = db
  .prepare(
    `
  SELECT sql FROM sqlite_master WHERE type='table' AND name='tests'
`
  )
  .get();

if (testsSchema && testsSchema.sql.includes("REFERENCES folders (id)")) {
  console.log("  ✅ testsテーブル: FOREIGN KEY → folders");
} else {
  console.log("  ❌ testsテーブル: 外部キー制約に問題あり");
  console.log(`     SQL: ${testsSchema?.sql}`);
  allPassed = false;
}

// テスト4: test_foldersテーブルの外部キー確認
console.log("\n[テスト4] test_foldersテーブルの外部キー確認");
const testFoldersSchema = db
  .prepare(
    `
  SELECT sql FROM sqlite_master WHERE type='table' AND name='test_folders'
`
  )
  .get();

const hasFoldersRef =
  testFoldersSchema &&
  testFoldersSchema.sql.includes("REFERENCES folders (id)");
const hasTestsRef =
  testFoldersSchema && testFoldersSchema.sql.includes("REFERENCES tests (id)");

if (hasFoldersRef && hasTestsRef) {
  console.log("  ✅ test_foldersテーブル: FOREIGN KEY → tests, folders");
} else {
  console.log("  ❌ test_foldersテーブル: 外部キー制約に問題あり");
  if (!hasFoldersRef) console.log("     - foldersへの参照なし");
  if (!hasTestsRef) console.log("     - testsへの参照なし");
  allPassed = false;
}

// テスト5: 未分類フォルダの存在確認
console.log("\n[テスト5] 未分類フォルダの確認");
const uncategorized = db
  .prepare(
    `
  SELECT id FROM folders WHERE name = '未分類'
`
  )
  .get();

if (uncategorized) {
  console.log(`  ✅ 未分類フォルダ存在 (ID: ${uncategorized.id})`);
} else {
  console.log("  ⚠️  未分類フォルダが存在しません(警告)");
}

// テスト6: 同名フォルダのテスト
console.log("\n[テスト6] 同名フォルダの作成テスト");
try {
  // テスト用親フォルダ作成
  const parent1 = db
    .prepare("INSERT INTO folders (name, parent_id) VALUES (?, ?)")
    .run("検証用親1", null);
  const parent2 = db
    .prepare("INSERT INTO folders (name, parent_id) VALUES (?, ?)")
    .run("検証用親2", null);

  // 異なる親の下に同名フォルダ作成
  db.prepare("INSERT INTO folders (name, parent_id) VALUES (?, ?)").run(
    "検証用子",
    parent1.lastInsertRowid
  );
  db.prepare("INSERT INTO folders (name, parent_id) VALUES (?, ?)").run(
    "検証用子",
    parent2.lastInsertRowid
  );

  console.log("  ✅ 異なる親での同名フォルダ作成: 成功");

  // 同じ親の下に同名フォルダを作成しようとする
  try {
    db.prepare("INSERT INTO folders (name, parent_id) VALUES (?, ?)").run(
      "検証用子",
      parent1.lastInsertRowid
    );
    console.log("  ❌ 同じ親での同名フォルダ作成: エラーが出るべき");
    allPassed = false;
  } catch (error) {
    if (error.message.includes("UNIQUE constraint failed")) {
      console.log("  ✅ 同じ親での同名フォルダ作成: 正しくエラー");
    } else {
      console.log(`  ❌ 予期しないエラー: ${error.message}`);
      allPassed = false;
    }
  }

  // クリーンアップ
  db.prepare("DELETE FROM folders WHERE name LIKE '検証用%'").run();
} catch (error) {
  console.log(`  ❌ テスト失敗: ${error.message}`);
  allPassed = false;
}

// 最終結果
console.log("\n" + "=".repeat(50));
if (allPassed) {
  console.log("🎉 すべての検証に合格しました!");
  console.log("\n✅ マイグレーションは正常に完了しています");
  console.log("✅ テスト作成機能が正常に動作するはずです");
} else {
  console.log("❌ いくつかの検証に失敗しました");
  console.log("\n以下のマイグレーションを実行してください:");
  console.log("  1. node migrate-folder-unique-constraint.mjs");
  console.log("  2. node fix-tests-foreign-key.mjs");
  console.log("  3. node fix-test-folders-foreign-key.mjs");
  process.exit(1);
}

db.close();
