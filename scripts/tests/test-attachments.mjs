import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), "../..");

const dbPath = path.join(__dirname, "data", "tests.db");
const db = new Database(dbPath);

console.log("=== テスト添付ファイル機能の確認 ===\n");

// 1. test_attachmentsテーブルの存在確認
console.log("1. test_attachmentsテーブルの確認:");
const tableInfo = db
  .prepare(
    `
  SELECT name FROM sqlite_master WHERE type='table' AND name='test_attachments'
`
  )
  .get();

if (tableInfo) {
  console.log("✅ test_attachmentsテーブルが存在します\n");

  // テーブル構造を表示
  const columns = db.prepare("PRAGMA table_info(test_attachments)").all();
  console.log("テーブル構造:");
  columns.forEach((col) => {
    console.log(
      `  - ${col.name} (${col.type}${col.notnull ? ", NOT NULL" : ""}${
        col.pk ? ", PRIMARY KEY" : ""
      })`
    );
  });
  console.log("");
} else {
  console.log("❌ test_attachmentsテーブルが存在しません\n");
}

// 2. 添付ファイルがあるテストを確認
console.log("2. 添付ファイル付きテストの確認:");
const testsWithAttachments = db
  .prepare(
    `
  SELECT 
    t.id,
    t.name,
    COUNT(ta.id) as attachment_count
  FROM tests t
  LEFT JOIN test_attachments ta ON t.id = ta.test_id
  GROUP BY t.id
  HAVING COUNT(ta.id) > 0
`
  )
  .all();

if (testsWithAttachments.length > 0) {
  console.log(`✅ 添付ファイル付きテスト: ${testsWithAttachments.length}件`);
  testsWithAttachments.forEach((test) => {
    console.log(
      `  - テストID ${test.id}: "${test.name}" (添付: ${test.attachment_count}件)`
    );

    // 詳細を表示
    const attachments = db
      .prepare(
        `
      SELECT * FROM test_attachments WHERE test_id = ?
    `
      )
      .all(test.id);

    attachments.forEach((att, index) => {
      console.log(`    ${index + 1}. ${att.file_name}`);
      console.log(`       パス: ${att.file_path}`);
      console.log(`       アップロード日時: ${att.uploaded_at}`);
    });
  });
  console.log("");
} else {
  console.log("⚠️  添付ファイル付きテストはありません\n");
}

// 3. 全テストの添付ファイル統計
console.log("3. 全体統計:");
const stats = db
  .prepare(
    `
  SELECT 
    COUNT(DISTINCT t.id) as total_tests,
    COUNT(ta.id) as total_attachments,
    COUNT(DISTINCT CASE WHEN ta.id IS NOT NULL THEN t.id END) as tests_with_attachments
  FROM tests t
  LEFT JOIN test_attachments ta ON t.id = ta.test_id
`
  )
  .get();

console.log(`  - 総テスト数: ${stats.total_tests}件`);
console.log(`  - 総添付ファイル数: ${stats.total_attachments}件`);
console.log(`  - 添付ファイルを持つテスト: ${stats.tests_with_attachments}件`);
console.log(
  `  - 添付ファイルを持たないテスト: ${
    stats.total_tests - stats.tests_with_attachments
  }件`
);
console.log("");

// 4. 最新のテストを確認
console.log("4. 最新のテスト(直近5件):");
const recentTests = db
  .prepare(
    `
  SELECT 
    t.id,
    t.name,
    t.subject,
    t.grade,
    COUNT(ta.id) as attachment_count,
    t.created_at
  FROM tests t
  LEFT JOIN test_attachments ta ON t.id = ta.test_id
  GROUP BY t.id
  ORDER BY t.created_at DESC
  LIMIT 5
`
  )
  .all();

recentTests.forEach((test, index) => {
  console.log(`  ${index + 1}. [ID: ${test.id}] ${test.name}`);
  console.log(`     学年: ${test.grade}, 科目: ${test.subject}`);
  console.log(`     添付ファイル: ${test.attachment_count}件`);
  console.log(`     作成日時: ${test.created_at}`);
  console.log("");
});

db.close();
console.log("=== 確認完了 ===");
