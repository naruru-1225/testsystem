/**
 * 本番環境でマイグレーション1実行後の詳細診断スクリプト
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "tests.db");

console.log("=".repeat(70));
console.log("🔍 マイグレーション1実行後の詳細診断");
console.log("=".repeat(70));

try {
  const db = new Database(dbPath);

  // 1. foldersテーブルの完全な構造
  console.log("\n[診断1] folders テーブルの構造:");
  console.log("-".repeat(70));

  const foldersSchema = db
    .prepare(
      `
    SELECT sql FROM sqlite_master WHERE type='table' AND name='folders'
  `
    )
    .get();

  if (foldersSchema) {
    console.log(foldersSchema.sql);
    console.log("");

    // UNIQUE制約のチェック
    if (foldersSchema.sql.includes("UNIQUE(name, parent_id)")) {
      console.log("✅ 新しい制約 UNIQUE(name, parent_id) が確認できました");
    } else if (foldersSchema.sql.includes("name TEXT NOT NULL UNIQUE")) {
      console.log("❌ まだ古い制約 UNIQUE(name) のままです");
      console.log("   → マイグレーション1が正しく実行されていません");
    } else {
      console.log("⚠️  UNIQUE制約が不明な状態です");
    }

    // order_indexカラムの確認
    if (foldersSchema.sql.includes("order_index")) {
      console.log("✅ order_index カラムが存在します");
    } else {
      console.log("⚠️  order_index カラムがありません");
      console.log("   → 本番環境と開発環境でスキーマが異なります");
    }
  } else {
    console.log("❌ foldersテーブルが見つかりません");
  }

  // 2. folders_oldテーブルの確認
  console.log("\n[診断2] folders_old テーブルの残存確認:");
  console.log("-".repeat(70));

  const foldersOld = db
    .prepare(
      `
    SELECT sql FROM sqlite_master WHERE type='table' AND name='folders_old'
  `
    )
    .get();

  if (foldersOld) {
    console.log("❌ folders_old テーブルが残っています!");
    console.log("   → マイグレーション1が途中で失敗した可能性があります");
    console.log("");
    console.log("テーブル構造:");
    console.log(foldersOld.sql);

    // データ件数を確認
    const oldCount = db
      .prepare("SELECT COUNT(*) as count FROM folders_old")
      .get();
    console.log(`\nデータ件数: ${oldCount.count}件`);
  } else {
    console.log("✅ folders_old は存在しません(正常)");
  }

  // 3. testsテーブルの外部キー参照
  console.log("\n[診断3] tests テーブルの外部キー参照:");
  console.log("-".repeat(70));

  const testsSchema = db
    .prepare(
      `
    SELECT sql FROM sqlite_master WHERE type='table' AND name='tests'
  `
    )
    .get();

  if (testsSchema) {
    // 外部キーの行を抽出
    const lines = testsSchema.sql.split("\n");
    const fkLine = lines.find(
      (line) => line.includes("FOREIGN KEY") && line.includes("folder_id")
    );

    if (fkLine) {
      console.log(fkLine.trim());

      if (fkLine.includes("folders_old")) {
        console.log("\n❌ まだ folders_old への参照があります");
        console.log("   これが原因でステップ2が失敗します");
      } else if (fkLine.includes("REFERENCES folders")) {
        console.log("\n✅ folders への正しい参照です");
      }
    }
  }

  // 4. 他のテーブルの古い参照チェック
  console.log("\n[診断4] すべてのテーブルで古い参照をチェック:");
  console.log("-".repeat(70));

  const allTables = db
    .prepare(
      `
    SELECT name, sql FROM sqlite_master 
    WHERE type='table' 
    AND (sql LIKE '%folders_old%' OR sql LIKE '%tests_backup%')
  `
    )
    .all();

  if (allTables.length === 0) {
    console.log("✅ 古い参照は見つかりませんでした");
  } else {
    console.log(`❌ ${allTables.length}個のテーブルに古い参照があります:`);
    allTables.forEach((table) => {
      console.log(`\n  テーブル: ${table.name}`);
      if (table.sql.includes("folders_old")) {
        console.log("    - folders_old への参照あり");
      }
      if (table.sql.includes("tests_backup")) {
        console.log("    - tests_backup への参照あり");
      }
    });
  }

  // 5. フォルダデータの確認
  console.log("\n[診断5] フォルダデータ:");
  console.log("-".repeat(70));

  const folderCount = db.prepare("SELECT COUNT(*) as count FROM folders").get();
  console.log(`フォルダ数: ${folderCount.count}件`);

  if (folderCount.count > 0) {
    const folders = db
      .prepare(
        `
      SELECT id, name, parent_id 
      FROM folders 
      ORDER BY id 
      LIMIT 5
    `
      )
      .all();

    console.log("\n最初の5件:");
    folders.forEach((f) => {
      console.log(`  [${f.id}] ${f.name} (親ID: ${f.parent_id || "なし"})`);
    });

    if (folderCount.count > 5) {
      console.log(`  ... 他 ${folderCount.count - 5}件`);
    }
  }

  // 6. マイグレーション状態の判定
  console.log("\n" + "=".repeat(70));
  console.log("📊 マイグレーション状態の判定:");
  console.log("=".repeat(70));

  const hasNewConstraint =
    foldersSchema && foldersSchema.sql.includes("UNIQUE(name, parent_id)");
  const noOldTable = !foldersOld;
  const noOldRefs = allTables.length === 0;

  console.log(
    `\n[ステップ1] folders テーブルの制約変更: ${
      hasNewConstraint ? "✅ 完了" : "❌ 未完了"
    }`
  );
  console.log(
    `[クリーンアップ] folders_old の削除: ${noOldTable ? "✅ 完了" : "❌ 残存"}`
  );
  console.log(`[整合性] 古い参照の削除: ${noOldRefs ? "✅ 完了" : "❌ 残存"}`);

  console.log("\n💡 次のアクション:");

  if (!hasNewConstraint) {
    console.log("  ❌ マイグレーション1が正しく実行されていません");
    console.log("     → バックアップから復元して再実行してください");
  } else if (!noOldTable) {
    console.log("  ⚠️  folders_old が残っています");
    console.log("     → DROP TABLE folders_old を実行してください");
  } else if (!noOldRefs) {
    console.log("  ⚠️  他のテーブルに古い参照が残っています");
    console.log("     → ステップ2以降のマイグレーションを実行してください");
  } else {
    console.log("  ✅ マイグレーション1は完全に完了しています");
    console.log("     → ステップ2を実行できます");
  }

  console.log("\n" + "=".repeat(70));

  db.close();
} catch (error) {
  console.error("\n❌ エラーが発生しました:");
  console.error(error);
  console.error("\n詳細:", error.message);

  if (error.message.includes("no such table")) {
    console.error(
      "\n💡 データベースファイルが見つからないか、テーブルが存在しません"
    );
    console.error("   data/tests.db が正しい場所にあるか確認してください");
  }

  process.exit(1);
}
