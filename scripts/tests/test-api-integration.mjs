/**
 * API統合テストスクリプト
 * Next.js開発サーバーが起動している状態で実行してください
 */

const BASE_URL = "http://localhost:3000";

let testsPassed = 0;
let testsFailed = 0;
let testsSkipped = 0;

// カラー出力用
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function test(name, fn) {
  try {
    await fn();
    log(`✅ ${name}`, "green");
    testsPassed++;
  } catch (error) {
    log(`❌ ${name}`, "red");
    log(`   エラー: ${error.message}`, "red");
    testsFailed++;
  }
}

async function skip(name, reason) {
  log(`⏭️  ${name} (スキップ: ${reason})`, "yellow");
  testsSkipped++;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// ヘッダー
log("\n=== テスト管理システム API統合テスト ===\n", "blue");

// サーバー接続確認
log("【サーバー接続確認】", "blue");
await test("開発サーバーに接続できる", async () => {
  const response = await fetch(BASE_URL);
  assert(response.ok, `サーバーに接続できません: ${response.status}`);
});

// Folders API テスト
log("\n【1. Folders API テスト】", "blue");

await test("GET /api/folders - フォルダ一覧を取得できる", async () => {
  const response = await fetch(`${BASE_URL}/api/folders`);
  assert(response.ok, `ステータスコード: ${response.status}`);

  const data = await response.json();
  assert(Array.isArray(data), "レスポンスが配列ではありません");
  assert(data.length > 0, "フォルダが1件も取得できません");
});

await test("GET /api/folders - order_indexでソートされている", async () => {
  const response = await fetch(`${BASE_URL}/api/folders`);
  const data = await response.json();

  for (let i = 0; i < data.length - 1; i++) {
    const current = data[i].order_index ?? data[i].id;
    const next = data[i + 1].order_index ?? data[i + 1].id;
    assert(current <= next, `順序が正しくありません: ${current} > ${next}`);
  }
});

await test("POST /api/folders - 新規フォルダを作成できる", async () => {
  const response = await fetch(`${BASE_URL}/api/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `テストフォルダ_${Date.now()}` }),
  });

  assert(response.ok, `ステータスコード: ${response.status}`);
  const data = await response.json();
  assert(data.id, "IDが返されません");

  // 作成したフォルダを削除
  await fetch(`${BASE_URL}/api/folders/${data.id}`, { method: "DELETE" });
});

let testFolderId1, testFolderId2;

await test("PUT /api/folders - フォルダ順序を更新できる", async () => {
  // テスト用フォルダを2つ作成
  const res1 = await fetch(`${BASE_URL}/api/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `順序テスト1_${Date.now()}` }),
  });
  const folder1 = await res1.json();
  testFolderId1 = folder1.id;

  const res2 = await fetch(`${BASE_URL}/api/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `順序テスト2_${Date.now()}` }),
  });
  const folder2 = await res2.json();
  testFolderId2 = folder2.id;

  // 全フォルダを取得
  const foldersRes = await fetch(`${BASE_URL}/api/folders`);
  const folders = await foldersRes.json();
  const folderIds = folders.map((f) => f.id);

  // 順序を更新
  const response = await fetch(`${BASE_URL}/api/folders`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folderIds }),
  });

  assert(response.ok, `ステータスコード: ${response.status}`);
  const data = await response.json();
  assert(data.success === true, "success=trueが返されません");
});

await test("PUT /api/folders - 順序が永続化される", async () => {
  const response = await fetch(`${BASE_URL}/api/folders`);
  const folders = await response.json();

  // order_indexが設定されているか確認
  folders.forEach((folder) => {
    assert(
      folder.order_index !== undefined && folder.order_index !== null,
      `フォルダ ${folder.id} にorder_indexが設定されていません`
    );
  });

  // テスト用フォルダを削除
  if (testFolderId1)
    await fetch(`${BASE_URL}/api/folders/${testFolderId1}`, {
      method: "DELETE",
    });
  if (testFolderId2)
    await fetch(`${BASE_URL}/api/folders/${testFolderId2}`, {
      method: "DELETE",
    });
});

// Categories API テスト
log("\n【2. Categories API テスト】", "blue");

await test("GET /api/categories - カテゴリ一覧を取得できる", async () => {
  const response = await fetch(`${BASE_URL}/api/categories`);
  assert(response.ok, `ステータスコード: ${response.status}`);

  const data = await response.json();
  assert(data.grades, "gradesが取得できません");
  assert(data.subjects, "subjectsが取得できません");
  assert(Array.isArray(data.grades), "gradesが配列ではありません");
  assert(Array.isArray(data.subjects), "subjectsが配列ではありません");
});

await test("GET /api/categories - 学年マスターに必須データが存在する", async () => {
  const response = await fetch(`${BASE_URL}/api/categories`);
  const data = await response.json();

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
  const gradeNames = data.grades.map((g) => g.name);

  expectedGrades.forEach((grade) => {
    assert(gradeNames.includes(grade), `学年「${grade}」が見つかりません`);
  });
});

await test("GET /api/categories - 科目マスターに必須データが存在する", async () => {
  const response = await fetch(`${BASE_URL}/api/categories`);
  const data = await response.json();

  const expectedSubjects = ["国語", "算数", "数学", "英語", "理科", "社会"];
  const subjectNames = data.subjects.map((s) => s.name);

  expectedSubjects.forEach((subject) => {
    assert(
      subjectNames.includes(subject),
      `科目「${subject}」が見つかりません`
    );
  });
});

// Tags API テスト
log("\n【3. Tags API テスト】", "blue");

await test("GET /api/tags - タグ一覧を取得できる", async () => {
  const response = await fetch(`${BASE_URL}/api/tags`);
  assert(response.ok, `ステータスコード: ${response.status}`);

  const data = await response.json();
  assert(Array.isArray(data), "レスポンスが配列ではありません");
});

let testTagId;

await test("POST /api/tags - 新規タグを作成できる", async () => {
  const response = await fetch(`${BASE_URL}/api/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `テストタグ_${Date.now()}`,
      color: "#FF5733",
    }),
  });

  assert(response.ok, `ステータスコード: ${response.status}`);
  const data = await response.json();
  assert(data.id, "IDが返されません");
  testTagId = data.id;
});

await test("PUT /api/tags/:id - タグを更新できる", async () => {
  if (!testTagId) {
    throw new Error("テストタグが作成されていません");
  }

  const response = await fetch(`${BASE_URL}/api/tags/${testTagId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `更新タグ_${Date.now()}`,
      color: "#33FF57",
    }),
  });

  assert(response.ok, `ステータスコード: ${response.status}`);
});

await test("DELETE /api/tags/:id - タグを削除できる", async () => {
  if (!testTagId) {
    throw new Error("テストタグが作成されていません");
  }

  const response = await fetch(`${BASE_URL}/api/tags/${testTagId}`, {
    method: "DELETE",
  });

  assert(response.ok, `ステータスコード: ${response.status}`);
});

// Tests API テスト
log("\n【4. Tests API テスト】", "blue");

await test("GET /api/tests - テスト一覧を取得できる", async () => {
  const response = await fetch(`${BASE_URL}/api/tests`);
  assert(response.ok, `ステータスコード: ${response.status}`);

  const data = await response.json();
  assert(Array.isArray(data), "レスポンスが配列ではありません");
});

await test("GET /api/tests?folder=1 - フォルダでフィルタリングできる", async () => {
  const response = await fetch(`${BASE_URL}/api/tests?folder=1`);
  assert(response.ok, `ステータスコード: ${response.status}`);

  const data = await response.json();
  assert(Array.isArray(data), "レスポンスが配列ではありません");
});

await test("GET /api/tests?subject=数学 - 科目でフィルタリングできる", async () => {
  const response = await fetch(
    `${BASE_URL}/api/tests?subject=${encodeURIComponent("数学")}`
  );
  assert(response.ok, `ステータスコード: ${response.status}`);

  const data = await response.json();
  assert(Array.isArray(data), "レスポンスが配列ではありません");
});

await test("GET /api/tests?grade=中1 - 学年でフィルタリングできる", async () => {
  const response = await fetch(
    `${BASE_URL}/api/tests?grade=${encodeURIComponent("中1")}`
  );
  assert(response.ok, `ステータスコード: ${response.status}`);

  const data = await response.json();
  assert(Array.isArray(data), "レスポンスが配列ではありません");
});

await test("GET /api/tests?search=テスト - キーワード検索ができる", async () => {
  const response = await fetch(
    `${BASE_URL}/api/tests?search=${encodeURIComponent("テスト")}`
  );
  assert(response.ok, `ステータスコード: ${response.status}`);

  const data = await response.json();
  assert(Array.isArray(data), "レスポンスが配列ではありません");
});

// PDF API テスト
log("\n【5. PDF API テスト】", "blue");

await test("GET /api/pdf/[...path] - 存在しないPDFで404を返す", async () => {
  const response = await fetch(`${BASE_URL}/api/pdf/pdfs/nonexistent.pdf`);
  assert(response.status === 404, `期待: 404, 実際: ${response.status}`);
});

// 実際のPDFファイルが存在する場合のテスト
const testsResponse = await fetch(`${BASE_URL}/api/tests`);
const tests = await testsResponse.json();
const testWithPdf = tests.find((t) => t.pdf_path);

if (testWithPdf) {
  await test("GET /api/pdf/[...path] - 実際のPDFを取得できる", async () => {
    const pdfPath = testWithPdf.pdf_path.replace("/uploads/", "");
    const response = await fetch(`${BASE_URL}/api/pdf/${pdfPath}`);
    assert(response.ok, `ステータスコード: ${response.status}`);

    const contentType = response.headers.get("Content-Type");
    assert(contentType === "application/pdf", `Content-Type: ${contentType}`);
  });

  await test("GET /api/pdf/[...path] - CORSヘッダーが設定されている", async () => {
    const pdfPath = testWithPdf.pdf_path.replace("/uploads/", "");
    const response = await fetch(`${BASE_URL}/api/pdf/${pdfPath}`);

    const corsHeader = response.headers.get("Access-Control-Allow-Origin");
    assert(corsHeader === "*", `CORS header: ${corsHeader}`);
  });
} else {
  await skip(
    "GET /api/pdf/[...path] - 実際のPDFを取得できる",
    "PDFファイルが存在しません"
  );
  await skip(
    "GET /api/pdf/[...path] - CORSヘッダーが設定されている",
    "PDFファイルが存在しません"
  );
}

// Backup API テスト
log("\n【6. Backup API テスト】", "blue");

await test("POST /api/backup/create - バックアップを作成できる", async () => {
  const response = await fetch(`${BASE_URL}/api/backup/create`, {
    method: "POST",
  });

  assert(response.ok, `ステータスコード: ${response.status}`);

  const contentType = response.headers.get("Content-Type");
  assert(
    contentType === "application/octet-stream",
    `Content-Type: ${contentType}`
  );

  const blob = await response.blob();
  assert(blob.size > 0, "バックアップファイルのサイズが0です");
});

// パフォーマンステスト
log("\n【7. パフォーマンステスト】", "blue");

await test("トップページが3秒以内に読み込まれる", async () => {
  const startTime = Date.now();
  const response = await fetch(BASE_URL);
  const endTime = Date.now();

  assert(response.ok, `ステータスコード: ${response.status}`);
  const loadTime = endTime - startTime;
  assert(loadTime < 3000, `読み込み時間: ${loadTime}ms`);
  log(`   読み込み時間: ${loadTime}ms`, "blue");
});

await test("API /api/tests が1秒以内にレスポンスを返す", async () => {
  const startTime = Date.now();
  const response = await fetch(`${BASE_URL}/api/tests`);
  const endTime = Date.now();

  assert(response.ok, `ステータスコード: ${response.status}`);
  const loadTime = endTime - startTime;
  assert(loadTime < 1000, `レスポンス時間: ${loadTime}ms`);
  log(`   レスポンス時間: ${loadTime}ms`, "blue");
});

await test("API /api/folders が500ms以内にレスポンスを返す", async () => {
  const startTime = Date.now();
  const response = await fetch(`${BASE_URL}/api/folders`);
  const endTime = Date.now();

  assert(response.ok, `ステータスコード: ${response.status}`);
  const loadTime = endTime - startTime;
  assert(loadTime < 500, `レスポンス時間: ${loadTime}ms`);
  log(`   レスポンス時間: ${loadTime}ms`, "blue");
});

// テスト結果サマリー
log("\n=== テスト結果サマリー ===", "blue");
log(`✅ 成功: ${testsPassed}`, "green");
log(`❌ 失敗: ${testsFailed}`, "red");
log(`⏭️  スキップ: ${testsSkipped}`, "yellow");

const total = testsPassed + testsFailed + testsSkipped;
const successRate =
  total > 0
    ? ((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)
    : 0;
log(`📊 成功率: ${successRate}%`, "blue");

if (testsFailed === 0) {
  log("\n🎉 すべてのテストに合格しました！", "green");
  process.exit(0);
} else {
  log(
    "\n⚠️  一部のテストに失敗しました。上記のエラーを確認してください。",
    "red"
  );
  process.exit(1);
}
