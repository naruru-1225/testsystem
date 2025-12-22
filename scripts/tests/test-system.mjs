import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), "../..");

const DB_PATH = path.join(__dirname, "data", "tests.db");
const db = new Database(DB_PATH);

console.log("=== テスト管理システム 機能テスト ===\n");

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passedTests++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   エラー: ${error.message}`);
    failedTests++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// 1. データベース構造のテスト
console.log("【1. データベース構造テスト】");

test("foldersテーブルが存在する", () => {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='folders'"
    )
    .all();
  assert(tables.length === 1, "foldersテーブルが見つかりません");
});

test("testsテーブルが存在する", () => {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tests'"
    )
    .all();
  assert(tables.length === 1, "testsテーブルが見つかりません");
});

test("tagsテーブルが存在する", () => {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tags'"
    )
    .all();
  assert(tables.length === 1, "tagsテーブルが見つかりません");
});

test("test_attachmentsテーブルが存在する", () => {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='test_attachments'"
    )
    .all();
  assert(tables.length === 1, "test_attachmentsテーブルが見つかりません");
});

test("gradesテーブルが存在する", () => {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='grades'"
    )
    .all();
  assert(tables.length === 1, "gradesテーブルが見つかりません");
});

test("subjectsテーブルが存在する", () => {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='subjects'"
    )
    .all();
  assert(tables.length === 1, "subjectsテーブルが見つかりません");
});

// 2. フォルダ機能のテスト
console.log("\n【2. フォルダ機能テスト】");

test("デフォルトフォルダ「すべてのテスト」が存在する", () => {
  const folder = db
    .prepare("SELECT * FROM folders WHERE name = 'すべてのテスト'")
    .get();
  assert(folder !== undefined, "「すべてのテスト」フォルダが見つかりません");
});

test("デフォルトフォルダ「未分類」が存在する", () => {
  const folder = db
    .prepare("SELECT * FROM folders WHERE name = '未分類'")
    .get();
  assert(folder !== undefined, "「未分類」フォルダが見つかりません");
});

test("foldersテーブルにorder_indexカラムが存在する", () => {
  const columns = db.prepare("PRAGMA table_info(folders)").all();
  const hasOrderIndex = columns.some((col) => col.name === "order_index");
  assert(hasOrderIndex, "order_indexカラムが見つかりません");
});

test("フォルダがorder_indexでソートされる", () => {
  const folders = db
    .prepare("SELECT * FROM folders ORDER BY order_index ASC")
    .all();
  assert(folders.length > 0, "フォルダが見つかりません");

  // order_indexが昇順であることを確認
  for (let i = 0; i < folders.length - 1; i++) {
    assert(
      folders[i].order_index <= folders[i + 1].order_index,
      `フォルダの順序が正しくありません: ${folders[i].order_index} > ${
        folders[i + 1].order_index
      }`
    );
  }
});

// 3. テスト機能のテスト
console.log("\n【3. テスト機能テスト】");

test("testsテーブルに必須カラムが存在する", () => {
  const columns = db.prepare("PRAGMA table_info(tests)").all();
  const requiredColumns = [
    "id",
    "name",
    "subject",
    "grade",
    "folder_id",
    "created_at",
  ];

  requiredColumns.forEach((colName) => {
    const exists = columns.some((col) => col.name === colName);
    assert(exists, `${colName}カラムが見つかりません`);
  });
});

test("testsテーブルにpdf_pathカラムが存在する", () => {
  const columns = db.prepare("PRAGMA table_info(tests)").all();
  const hasPdfPath = columns.some((col) => col.name === "pdf_path");
  assert(hasPdfPath, "pdf_pathカラムが見つかりません");
});

test("testsテーブルにdescriptionカラムが存在する", () => {
  const columns = db.prepare("PRAGMA table_info(tests)").all();
  const hasDescription = columns.some((col) => col.name === "description");
  assert(hasDescription, "descriptionカラムが見つかりません");
});

test("testsテーブルにtotal_questionsカラムが存在する", () => {
  const columns = db.prepare("PRAGMA table_info(tests)").all();
  const hasTotalQuestions = columns.some(
    (col) => col.name === "total_questions"
  );
  assert(hasTotalQuestions, "total_questionsカラムが見つかりません");
});

test("testsテーブルにtotal_scoreカラムが存在する", () => {
  const columns = db.prepare("PRAGMA table_info(tests)").all();
  const hasTotalScore = columns.some((col) => col.name === "total_score");
  assert(hasTotalScore, "total_scoreカラムが見つかりません");
});

// 4. タグ機能のテスト
console.log("\n【4. タグ機能テスト】");

test("tagsテーブルにcolorカラムが存在する", () => {
  const columns = db.prepare("PRAGMA table_info(tags)").all();
  const hasColor = columns.some((col) => col.name === "color");
  assert(hasColor, "colorカラムが見つかりません");
});

test("test_tagsテーブルが存在する（多対多）", () => {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='test_tags'"
    )
    .all();
  assert(tables.length === 1, "test_tagsテーブルが見つかりません");
});

// 5. 添付ファイル機能のテスト
console.log("\n【5. 添付ファイル機能テスト】");

test("test_attachmentsテーブルに必須カラムが存在する", () => {
  const columns = db.prepare("PRAGMA table_info(test_attachments)").all();
  const requiredColumns = ["id", "test_id", "file_name", "file_path"];

  requiredColumns.forEach((colName) => {
    const exists = columns.some((col) => col.name === colName);
    assert(exists, `${colName}カラムが見つかりません`);
  });
});

// 6. 学年・科目マスターのテスト
console.log("\n【6. マスターデータテスト】");

test("学年マスターにデータが存在する", () => {
  const grades = db.prepare("SELECT * FROM grades").all();
  assert(grades.length > 0, "学年マスターが空です");
});

test("科目マスターにデータが存在する", () => {
  const subjects = db.prepare("SELECT * FROM subjects").all();
  assert(subjects.length > 0, "科目マスターが空です");
});

test("学年マスターに必須データが存在する", () => {
  const expectedGrades = [
    "小1",
    "小2",
    "小3",
    "小4",
    "小5",
    "小6",
    "中1",
    "中2",
    "中3",
    "高1",
    "高2",
    "高3",
  ];
  const grades = db.prepare("SELECT name FROM grades").all();
  const gradeNames = grades.map((g) => g.name);

  expectedGrades.forEach((grade) => {
    assert(gradeNames.includes(grade), `学年「${grade}」が見つかりません`);
  });
});

test("科目マスターに必須データが存在する", () => {
  const expectedSubjects = ["国語", "算数", "数学", "英語", "理科", "社会"];
  const subjects = db.prepare("SELECT name FROM subjects").all();
  const subjectNames = subjects.map((s) => s.name);

  expectedSubjects.forEach((subject) => {
    assert(
      subjectNames.includes(subject),
      `科目「${subject}」が見つかりません`
    );
  });
});

// 7. 外部キー制約のテスト
console.log("\n【7. データ整合性テスト】");

test("testsテーブルのfolder_id外部キーが機能する", () => {
  try {
    // 存在しないフォルダIDでテストを作成しようとする
    db.prepare(
      "INSERT INTO tests (name, subject, grade, folder_id) VALUES (?, ?, ?, ?)"
    ).run("テスト", "国語", "中1", 99999);
    throw new Error("外部キー制約が機能していません");
  } catch (error) {
    assert(
      error.message.includes("FOREIGN KEY constraint failed"),
      "外部キー制約エラーが発生しませんでした"
    );
  }
});

test("test_tagsテーブルのUNIQUE制約が機能する", () => {
  // テストデータの存在を確認
  const tests = db.prepare("SELECT id FROM tests LIMIT 1").all();
  const tags = db.prepare("SELECT id FROM tags LIMIT 1").all();

  if (tests.length > 0 && tags.length > 0) {
    const testId = tests[0].id;
    const tagId = tags[0].id;

    try {
      // 同じ組み合わせを2回挿入
      db.prepare("DELETE FROM test_tags WHERE test_id = ? AND tag_id = ?").run(
        testId,
        tagId
      );
      db.prepare("INSERT INTO test_tags (test_id, tag_id) VALUES (?, ?)").run(
        testId,
        tagId
      );
      db.prepare("INSERT INTO test_tags (test_id, tag_id) VALUES (?, ?)").run(
        testId,
        tagId
      );
      throw new Error("UNIQUE制約が機能していません");
    } catch (error) {
      assert(
        error.message.includes("UNIQUE constraint failed"),
        "UNIQUE制約エラーが発生しませんでした"
      );
    }
  }
});

// 8. 多対多関連のテスト
console.log("\n【8. リレーションシップテスト】");

test("test_foldersテーブルが存在する（テストとフォルダの多対多）", () => {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='test_folders'"
    )
    .all();
  assert(tables.length === 1, "test_foldersテーブルが見つかりません");
});

// 9. 統計情報
console.log("\n【9. データベース統計】");

const folderCount = db
  .prepare("SELECT COUNT(*) as count FROM folders")
  .get().count;
const testCount = db.prepare("SELECT COUNT(*) as count FROM tests").get().count;
const tagCount = db.prepare("SELECT COUNT(*) as count FROM tags").get().count;
const attachmentCount = db
  .prepare("SELECT COUNT(*) as count FROM test_attachments")
  .get().count;
const gradeCount = db
  .prepare("SELECT COUNT(*) as count FROM grades")
  .get().count;
const subjectCount = db
  .prepare("SELECT COUNT(*) as count FROM subjects")
  .get().count;

console.log(`📁 フォルダ数: ${folderCount}`);
console.log(`📝 テスト数: ${testCount}`);
console.log(`🏷️  タグ数: ${tagCount}`);
console.log(`📎 添付ファイル数: ${attachmentCount}`);
console.log(`👨‍🎓 学年数: ${gradeCount}`);
console.log(`📚 科目数: ${subjectCount}`);

// 10. テスト結果サマリー
console.log("\n=== テスト結果サマリー ===");
console.log(`✅ 成功: ${passedTests}`);
console.log(`❌ 失敗: ${failedTests}`);
console.log(
  `📊 成功率: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(
    1
  )}%`
);

if (failedTests === 0) {
  console.log("\n🎉 すべてのテストに合格しました！");
} else {
  console.log(
    "\n⚠️  一部のテストに失敗しました。上記のエラーを確認してください。"
  );
  process.exit(1);
}

db.close();
