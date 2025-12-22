/**
 * フォルダの一意制約を変更するマイグレーションスクリプト（安全版）
 *
 * 変更内容:
 * - UNIQUE(name) → UNIQUE(name, parent_id)
 * - 親フォルダが異なれば同名フォルダを作成可能にする
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "tests.db");
const db = new Database(dbPath);

console.log("=".repeat(70));
console.log("🔄 フォルダテーブルの一意制約を変更");
console.log("=".repeat(70));

try {
  // マイグレーション前の状態確認
  console.log("\n[1] マイグレーション前の状態確認:");
  console.log("-".repeat(70));

  const beforeCount = db.prepare("SELECT COUNT(*) as count FROM folders").get();
  console.log(`  現在のフォルダ数: ${beforeCount.count}件`);

  if (beforeCount.count === 0) {
    console.log("  ⚠️  フォルダデータがありません");
    console.log(
      "     マイグレーションを続行しますか? (続行する場合は --force フラグを追加)"
    );
    if (!process.argv.includes("--force")) {
      process.exit(0);
    }
  }

  // サンプルデータを表示
  const samples = db
    .prepare("SELECT id, name, parent_id FROM folders LIMIT 3")
    .all();
  console.log("\n  サンプルデータ:");
  samples.forEach((folder) => {
    const parentInfo = folder.parent_id
      ? ` (親ID: ${folder.parent_id})`
      : " (親なし)";
    console.log(`    [${folder.id}] ${folder.name}${parentInfo}`);
  });

  // 現在のテーブル構造を確認
  const currentSchema = db
    .prepare(
      `
    SELECT sql FROM sqlite_master 
    WHERE type='table' AND name='folders'
  `
    )
    .get();

  if (currentSchema.sql.includes("UNIQUE(name, parent_id)")) {
    console.log("\n  ✅ すでに正しい制約を持っています");
    console.log("     このマイグレーションは不要です");
    process.exit(0);
  }

  // マイグレーションの実行
  console.log("\n[2] マイグレーションの実行:");
  console.log("-".repeat(70));

  // 外部キー制約を一時的に無効化
  db.pragma("foreign_keys = OFF");
  db.exec("BEGIN TRANSACTION");

  try {
    // 1. 既存のfoldersテーブルをリネーム
    console.log("  📝 既存のfoldersテーブルを folders_old にリネーム...");
    db.exec("ALTER TABLE folders RENAME TO folders_old");

    // 2. 新しいスキーマでfoldersテーブルを作成
    console.log("  📝 新しいfoldersテーブルを作成...");
    db.exec(`
      CREATE TABLE folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
        order_index INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, parent_id)
      )
    `);

    // 3. データを新しいテーブルにコピー
    console.log("  📝 データをコピー中...");
    db.exec(`
      INSERT INTO folders (id, name, parent_id, order_index, created_at)
      SELECT id, name, parent_id, order_index, created_at
      FROM folders_old
    `);

    // データ件数を確認
    const afterCount = db
      .prepare("SELECT COUNT(*) as count FROM folders")
      .get();
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

    // 4. AUTOINCREMENTのシーケンスを更新
    const maxId = db.prepare("SELECT MAX(id) as max FROM folders").get();
    if (maxId && maxId.max) {
      db.exec(`
        INSERT OR REPLACE INTO sqlite_sequence (name, seq) 
        VALUES ('folders', ${maxId.max})
      `);
    }

    // 5. 古いテーブルを削除
    console.log("  �️  バックアップテーブルを削除...");
    db.exec("DROP TABLE folders_old");

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

  // マイグレーション後の確認
  console.log("\n[3] マイグレーション後の確認:");
  console.log("-".repeat(70));

  const finalCount = db.prepare("SELECT COUNT(*) as count FROM folders").get();
  console.log(`  最終フォルダ数: ${finalCount.count}件`);

  // テーブル構造の確認
  const newSchema = db
    .prepare(
      `
    SELECT sql FROM sqlite_master 
    WHERE type='table' AND name='folders'
  `
    )
    .get();

  if (newSchema.sql.includes("UNIQUE(name, parent_id)")) {
    console.log("  ✅ 一意制約が正しく設定されています");
  }

  console.log("\n  📊 フォルダ一覧:");
  const folders = db
    .prepare(
      `
    SELECT 
      id, 
      name, 
      parent_id,
      (SELECT name FROM folders AS p WHERE p.id = folders.parent_id) AS parent_name
    FROM folders 
    ORDER BY id
  `
    )
    .all();

  folders.forEach((folder) => {
    const parentInfo = folder.parent_name
      ? ` (親: ${folder.parent_name})`
      : " (親なし)";
    console.log(`    [${folder.id}] ${folder.name}${parentInfo}`);
  });

  console.log("\n" + "=".repeat(70));
  console.log("✅ マイグレーションが正常に完了しました!");
  console.log(
    `   ${finalCount.count}件のフォルダデータはすべて保持されています`
  );
  console.log("   これで親フォルダが異なれば同名フォルダを作成できます!");
  console.log("=".repeat(70));
} catch (error) {
  console.error("\n❌ マイグレーション失敗:", error.message);
  console.error("\nデータは元の状態で保護されています");
  process.exit(1);
} finally {
  db.close();
}
