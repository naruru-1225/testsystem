/**
 * タグのカスケード削除をテストするスクリプト
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "tests.db");
const db = new Database(dbPath);

console.log("🧪 タグのカスケード削除テスト\n");
console.log("=".repeat(60));

try {
  db.exec("BEGIN TRANSACTION");

  // テスト用タグを作成
  console.log("\n[準備] テスト用タグを作成...");
  const tagResult = db
    .prepare("INSERT INTO tags (name, color) VALUES (?, ?)")
    .run("テスト削除用タグ", "#FF0000");
  const tagId = tagResult.lastInsertRowid;
  console.log(`  ✓ タグID: ${tagId} を作成`);

  // テスト用テストを作成
  console.log("\n[準備] テスト用テストを作成...");

  // 未分類フォルダを取得
  const uncategorized = db
    .prepare("SELECT id FROM folders WHERE name = '未分類'")
    .get();

  if (!uncategorized) {
    throw new Error("未分類フォルダが見つかりません");
  }

  const testResult = db
    .prepare(
      "INSERT INTO tests (name, subject, grade, folder_id) VALUES (?, ?, ?, ?)"
    )
    .run("タグ削除テスト用", "テスト", "中1", uncategorized.id);
  const testId = testResult.lastInsertRowid;
  console.log(`  ✓ テストID: ${testId} を作成`);

  // テストにタグを紐付け
  console.log("\n[準備] テストにタグを紐付け...");
  db.prepare("INSERT INTO test_tags (test_id, tag_id) VALUES (?, ?)").run(
    testId,
    tagId
  );
  console.log(`  ✓ テストID ${testId} にタグID ${tagId} を紐付け`);

  // 現在の状態を確認
  console.log("\n[確認] 紐付け前の状態:");
  const beforeTestTags = db
    .prepare("SELECT COUNT(*) as count FROM test_tags WHERE tag_id = ?")
    .get(tagId);
  console.log(`  test_tags レコード数: ${beforeTestTags.count}件`);

  const beforeTest = db
    .prepare("SELECT id, name FROM tests WHERE id = ?")
    .get(testId);
  console.log(`  テスト存在確認: ${beforeTest ? "存在" : "なし"}`);

  // タグを削除
  console.log("\n[実行] タグを削除...");
  db.prepare("DELETE FROM tags WHERE id = ?").run(tagId);
  console.log(`  ✓ タグID ${tagId} を削除`);

  // 削除後の状態を確認
  console.log("\n[確認] 削除後の状態:");

  const afterTag = db.prepare("SELECT id FROM tags WHERE id = ?").get(tagId);
  console.log(`  タグ存在確認: ${afterTag ? "まだ存在(NG)" : "削除済み(OK)"}`);

  const afterTestTags = db
    .prepare("SELECT COUNT(*) as count FROM test_tags WHERE tag_id = ?")
    .get(tagId);
  console.log(
    `  test_tags レコード数: ${afterTestTags.count}件 ${
      afterTestTags.count === 0 ? "(自動削除された ✓)" : "(まだ残っている ✗)"
    }`
  );

  const afterTest = db
    .prepare("SELECT id, name FROM tests WHERE id = ?")
    .get(testId);
  console.log(`  テスト存在確認: ${afterTest ? "存在(OK)" : "削除された(NG)"}`);

  // 検証
  console.log("\n" + "=".repeat(60));

  const allPassed =
    !afterTag && afterTestTags.count === 0 && afterTest !== undefined;

  if (allPassed) {
    console.log("✅ すべてのテストが成功しました!");
    console.log("\n動作確認:");
    console.log("  ✓ タグが削除された");
    console.log(
      "  ✓ test_tags の関連レコードが自動削除された (ON DELETE CASCADE)"
    );
    console.log("  ✓ テスト本体は削除されずに残っている");
    console.log("\n👉 管理者メニューからタグを削除できます!");
  } else {
    console.log("❌ テストに失敗しました");
    if (afterTag) {
      console.log("  - タグが削除されていません");
    }
    if (afterTestTags.count > 0) {
      console.log("  - test_tags の関連レコードが削除されていません");
    }
    if (!afterTest) {
      console.log("  - テスト本体が削除されてしまいました");
    }
  }

  // ロールバック(テストデータをクリーンアップ)
  db.exec("ROLLBACK");
  console.log("\n✓ テストデータをクリーンアップしました");
} catch (error) {
  db.exec("ROLLBACK");
  console.error("\n❌ エラーが発生しました:", error);
  process.exit(1);
} finally {
  db.close();
}
