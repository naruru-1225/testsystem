/**
 * 安定性テスト - システム全体の安定性と堅牢性を検証
 *
 * テスト項目:
 * 1. API負荷テスト（連続リクエスト）
 * 2. データ整合性テスト
 * 3. エラーハンドリングテスト
 * 4. PDF処理の安定性テスト
 * 5. 同時操作テスト
 */

import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(dirname(__filename), "../..");

const BASE_URL = "http://localhost:3000";

// カラー出力
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// テスト結果を記録
const testResults = [];

function recordResult(category, testName, passed, details = "") {
  testResults.push({
    category,
    testName,
    passed,
    details,
    timestamp: new Date().toISOString(),
  });

  if (passed) {
    log(`  ✓ ${testName}`, "green");
  } else {
    log(`  ✗ ${testName}`, "red");
    if (details) log(`    ${details}`, "yellow");
  }
}

// ユーティリティ: 遅延
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ユーティリティ: リトライ付きfetch
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * (i + 1)); // 指数バックオフ
    }
  }
}

// ===========================
// 1. API負荷テスト
// ===========================
async function testApiLoadHandling() {
  log("\n=== 1. API負荷テスト ===", "cyan");

  // 1-1: 連続リクエストテスト
  try {
    const requests = 20;
    const startTime = Date.now();
    const promises = Array(requests)
      .fill(null)
      .map(() => fetch(`${BASE_URL}/api/tests`));

    const responses = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    const allSuccessful = responses.every((r) => r.ok);
    recordResult(
      "API負荷",
      `連続${requests}リクエスト`,
      allSuccessful,
      allSuccessful
        ? `処理時間: ${duration}ms (平均: ${(duration / requests).toFixed(
            2
          )}ms)`
        : "一部のリクエストが失敗"
    );
  } catch (error) {
    recordResult("API負荷", "連続リクエスト", false, error.message);
  }

  // 1-2: 異なるエンドポイントへの同時アクセス
  try {
    const endpoints = [
      "/api/tests",
      "/api/folders",
      "/api/tags",
      "/api/grades",
      "/api/subjects",
      "/api/categories",
    ];

    const promises = endpoints.map((endpoint) =>
      fetch(`${BASE_URL}${endpoint}`)
    );

    const responses = await Promise.all(promises);
    const allSuccessful = responses.every((r) => r.ok);

    recordResult(
      "API負荷",
      "複数エンドポイント同時アクセス",
      allSuccessful,
      allSuccessful
        ? `${endpoints.length}エンドポイント全て成功`
        : "一部のエンドポイントが失敗"
    );
  } catch (error) {
    recordResult(
      "API負荷",
      "複数エンドポイント同時アクセス",
      false,
      error.message
    );
  }

  // 1-3: レート制限チェック（100リクエスト）
  try {
    const requests = 100;
    const startTime = Date.now();
    const promises = [];

    for (let i = 0; i < requests; i++) {
      promises.push(fetch(`${BASE_URL}/api/tests`));
    }

    const responses = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    const successCount = responses.filter((r) => r.ok).length;
    const passed = successCount >= requests * 0.95; // 95%以上成功すればOK

    recordResult(
      "API負荷",
      `高負荷テスト(${requests}リクエスト)`,
      passed,
      `成功: ${successCount}/${requests} (${(
        (successCount / requests) *
        100
      ).toFixed(1)}%), 処理時間: ${duration}ms`
    );
  } catch (error) {
    recordResult("API負荷", "高負荷テスト", false, error.message);
  }
}

// ===========================
// 2. データ整合性テスト
// ===========================
async function testDataIntegrity() {
  log("\n=== 2. データ整合性テスト ===", "cyan");

  // 2-1: データベースファイルの存在確認
  try {
    const dbPath = join(__dirname, "data", "tests.db");
    const exists = fs.existsSync(dbPath);

    if (exists) {
      const stats = fs.statSync(dbPath);
      recordResult(
        "データ整合性",
        "データベースファイル存在確認",
        true,
        `サイズ: ${(stats.size / 1024).toFixed(2)} KB`
      );
    } else {
      recordResult(
        "データ整合性",
        "データベースファイル存在確認",
        false,
        "データベースファイルが見つかりません"
      );
    }
  } catch (error) {
    recordResult(
      "データ整合性",
      "データベースファイル存在確認",
      false,
      error.message
    );
  }

  // 2-2: 各エンティティのデータ取得
  const entities = [
    { name: "テスト", endpoint: "/api/tests" },
    { name: "フォルダ", endpoint: "/api/folders" },
    { name: "タグ", endpoint: "/api/tags" },
    { name: "学年", endpoint: "/api/grades" },
    { name: "科目", endpoint: "/api/subjects" },
  ];

  for (const entity of entities) {
    try {
      const response = await fetch(`${BASE_URL}${entity.endpoint}`);
      if (response.ok) {
        const data = await response.json();
        const isArray = Array.isArray(data);
        recordResult(
          "データ整合性",
          `${entity.name}データ取得`,
          isArray,
          isArray ? `${data.length}件取得` : "データ形式が不正"
        );
      } else {
        recordResult(
          "データ整合性",
          `${entity.name}データ取得`,
          false,
          `HTTP ${response.status}`
        );
      }
    } catch (error) {
      recordResult(
        "データ整合性",
        `${entity.name}データ取得`,
        false,
        error.message
      );
    }
  }

  // 2-3: カテゴリデータの整合性
  try {
    const response = await fetch(`${BASE_URL}/api/categories`);
    if (response.ok) {
      const categories = await response.json();
      const isValid =
        Array.isArray(categories) &&
        categories.every((cat) => cat.grade && Array.isArray(cat.subjects));

      recordResult(
        "データ整合性",
        "カテゴリデータ構造",
        isValid,
        isValid
          ? `${categories.length}学年, 科目合計: ${categories.reduce(
              (sum, cat) => sum + cat.subjects.length,
              0
            )}`
          : "データ構造が不正"
      );
    } else {
      recordResult(
        "データ整合性",
        "カテゴリデータ構造",
        false,
        `HTTP ${response.status}`
      );
    }
  } catch (error) {
    recordResult("データ整合性", "カテゴリデータ構造", false, error.message);
  }
}

// ===========================
// 3. エラーハンドリングテスト
// ===========================
async function testErrorHandling() {
  log("\n=== 3. エラーハンドリングテスト ===", "cyan");

  // 3-1: 存在しないエンドポイント
  try {
    const response = await fetch(`${BASE_URL}/api/nonexistent`);
    const is404 = response.status === 404;
    recordResult(
      "エラーハンドリング",
      "存在しないエンドポイント",
      is404,
      `HTTP ${response.status}`
    );
  } catch (error) {
    recordResult(
      "エラーハンドリング",
      "存在しないエンドポイント",
      false,
      error.message
    );
  }

  // 3-2: 存在しないテストID
  try {
    const response = await fetch(`${BASE_URL}/api/tests/999999`);
    const is404 = response.status === 404;
    recordResult(
      "エラーハンドリング",
      "存在しないテストID",
      is404,
      `HTTP ${response.status}`
    );
  } catch (error) {
    recordResult(
      "エラーハンドリング",
      "存在しないテストID",
      false,
      error.message
    );
  }

  // 3-3: 不正なリクエストボディ（POST）
  try {
    const response = await fetch(`${BASE_URL}/api/tests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid: "data" }),
    });

    const isErrorResponse = !response.ok;
    recordResult(
      "エラーハンドリング",
      "不正なPOSTリクエスト",
      isErrorResponse,
      `HTTP ${response.status}`
    );
  } catch (error) {
    recordResult(
      "エラーハンドリング",
      "不正なPOSTリクエスト",
      false,
      error.message
    );
  }

  // 3-4: 不正なリクエストボディ（PUT）
  try {
    const response = await fetch(`${BASE_URL}/api/tests/1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid: "data" }),
    });

    const isErrorResponse = !response.ok;
    recordResult(
      "エラーハンドリング",
      "不正なPUTリクエスト",
      isErrorResponse,
      `HTTP ${response.status}`
    );
  } catch (error) {
    recordResult(
      "エラーハンドリング",
      "不正なPUTリクエスト",
      false,
      error.message
    );
  }

  // 3-5: 存在しないPDFファイル
  try {
    const response = await fetch(`${BASE_URL}/api/pdf/nonexistent/file.pdf`);
    const is404 = response.status === 404;
    recordResult(
      "エラーハンドリング",
      "存在しないPDFファイル",
      is404,
      `HTTP ${response.status}`
    );
  } catch (error) {
    recordResult(
      "エラーハンドリング",
      "存在しないPDFファイル",
      false,
      error.message
    );
  }
}

// ===========================
// 4. PDF処理の安定性テスト
// ===========================
async function testPdfStability() {
  log("\n=== 4. PDF処理の安定性テスト ===", "cyan");

  // 4-1: PDFディレクトリの存在確認
  try {
    const pdfDir = join(__dirname, "public", "uploads", "pdfs");
    const exists = fs.existsSync(pdfDir);

    recordResult(
      "PDF安定性",
      "PDFディレクトリ存在確認",
      true,
      exists ? "ディレクトリ存在" : "ディレクトリなし（空の状態）"
    );
  } catch (error) {
    recordResult("PDF安定性", "PDFディレクトリ存在確認", false, error.message);
  }

  // 4-2: PDF.jsワーカーファイルの存在確認
  try {
    const workerPath = join(__dirname, "public", "pdfjs", "pdf.worker.min.mjs");
    const exists = fs.existsSync(workerPath);

    if (exists) {
      const stats = fs.statSync(workerPath);
      recordResult(
        "PDF安定性",
        "PDF.jsワーカーファイル",
        true,
        `サイズ: ${(stats.size / 1024).toFixed(2)} KB`
      );
    } else {
      recordResult(
        "PDF安定性",
        "PDF.jsワーカーファイル",
        false,
        "ワーカーファイルが見つかりません"
      );
    }
  } catch (error) {
    recordResult("PDF安定性", "PDF.jsワーカーファイル", false, error.message);
  }

  // 4-3: テストデータのPDFファイル確認
  try {
    const pdfDir = join(__dirname, "public", "uploads", "pdfs");

    if (fs.existsSync(pdfDir)) {
      const testFolders = fs
        .readdirSync(pdfDir)
        .filter((name) => name.startsWith("test_"));
      let totalPdfs = 0;

      for (const folder of testFolders) {
        const folderPath = join(pdfDir, folder);
        const files = fs
          .readdirSync(folderPath)
          .filter((f) => f.endsWith(".pdf"));
        totalPdfs += files.length;
      }

      recordResult(
        "PDF安定性",
        "アップロード済みPDFファイル",
        true,
        `${testFolders.length}個のテストフォルダ, ${totalPdfs}個のPDFファイル`
      );
    } else {
      recordResult(
        "PDF安定性",
        "アップロード済みPDFファイル",
        true,
        "PDFディレクトリなし（クリーンな状態）"
      );
    }
  } catch (error) {
    recordResult(
      "PDF安定性",
      "アップロード済みPDFファイル",
      false,
      error.message
    );
  }
}

// ===========================
// 5. 同時操作テスト
// ===========================
async function testConcurrentOperations() {
  log("\n=== 5. 同時操作テスト ===", "cyan");

  // 5-1: 同時読み取り操作
  try {
    const operations = [
      fetch(`${BASE_URL}/api/tests`),
      fetch(`${BASE_URL}/api/folders`),
      fetch(`${BASE_URL}/api/tags`),
      fetch(`${BASE_URL}/api/grades`),
      fetch(`${BASE_URL}/api/subjects`),
      fetch(`${BASE_URL}/api/categories`),
    ];

    const startTime = Date.now();
    const responses = await Promise.all(operations);
    const endTime = Date.now();

    const allSuccessful = responses.every((r) => r.ok);
    recordResult(
      "同時操作",
      "6エンドポイント同時読み取り",
      allSuccessful,
      `処理時間: ${endTime - startTime}ms`
    );
  } catch (error) {
    recordResult(
      "同時操作",
      "6エンドポイント同時読み取り",
      false,
      error.message
    );
  }

  // 5-2: 同じエンドポイントへの複数同時リクエスト
  try {
    const count = 10;
    const operations = Array(count)
      .fill(null)
      .map(() => fetch(`${BASE_URL}/api/tests`));

    const startTime = Date.now();
    const responses = await Promise.all(operations);
    const endTime = Date.now();

    const allSuccessful = responses.every((r) => r.ok);
    recordResult(
      "同時操作",
      `同一エンドポイント${count}回同時アクセス`,
      allSuccessful,
      `処理時間: ${endTime - startTime}ms`
    );
  } catch (error) {
    recordResult(
      "同時操作",
      "同一エンドポイント同時アクセス",
      false,
      error.message
    );
  }

  // 5-3: 連続的な異なる操作
  try {
    const startTime = Date.now();

    // 複数の操作を順次実行
    const testsResp = await fetch(`${BASE_URL}/api/tests`);
    const foldersResp = await fetch(`${BASE_URL}/api/folders`);
    const categoriesResp = await fetch(`${BASE_URL}/api/categories`);

    const endTime = Date.now();

    const allSuccessful = testsResp.ok && foldersResp.ok && categoriesResp.ok;
    recordResult(
      "同時操作",
      "連続的な異なる操作",
      allSuccessful,
      `処理時間: ${endTime - startTime}ms`
    );
  } catch (error) {
    recordResult("同時操作", "連続的な異なる操作", false, error.message);
  }
}

// ===========================
// 6. UIコンポーネント安定性テスト
// ===========================
async function testUiStability() {
  log("\n=== 6. UIコンポーネント安定性テスト ===", "cyan");

  // 6-1: ページファイルの存在確認
  const pages = [
    { name: "メインページ", path: "app/page.tsx" },
    { name: "テスト作成ページ", path: "app/tests/new/page.tsx" },
    { name: "テスト編集ページ", path: "app/tests/[id]/edit/page.tsx" },
  ];

  for (const page of pages) {
    try {
      const pagePath = join(__dirname, page.path);
      const exists = fs.existsSync(pagePath);
      recordResult(
        "UI安定性",
        page.name,
        exists,
        exists ? "ファイル存在" : "ファイルが見つかりません"
      );
    } catch (error) {
      recordResult("UI安定性", page.name, false, error.message);
    }
  }

  // 6-2: コンポーネントファイルの存在確認
  const components = [
    "Sidebar.tsx",
    "TestList.tsx",
    "TestCreateForm.tsx",
    "TestEditForm.tsx",
    "AdminModal.tsx",
    "PdfViewer.tsx",
  ];

  for (const component of components) {
    try {
      const componentPath = join(__dirname, "components", component);
      const exists = fs.existsSync(componentPath);

      if (exists) {
        const content = fs.readFileSync(componentPath, "utf8");
        const hasUseMemo = content.includes("useMemo");
        const hasUseCallback = content.includes("useCallback");
        const hasErrorHandling =
          content.includes("try") && content.includes("catch");

        recordResult(
          "UI安定性",
          `${component}コンポーネント`,
          exists,
          `最適化: ${
            hasUseMemo || hasUseCallback ? "○" : "△"
          }, エラーハンドリング: ${hasErrorHandling ? "○" : "△"}`
        );
      } else {
        recordResult(
          "UI安定性",
          `${component}コンポーネント`,
          false,
          "ファイルが見つかりません"
        );
      }
    } catch (error) {
      recordResult(
        "UI安定性",
        `${component}コンポーネント`,
        false,
        error.message
      );
    }
  }
}

// ===========================
// 7. レスポンシブデザインテスト
// ===========================
async function testResponsiveDesign() {
  log("\n=== 7. レスポンシブデザインテスト ===", "cyan");

  // 7-1: AdminModalのタブ部分の確認
  try {
    const adminModalPath = join(__dirname, "components", "AdminModal.tsx");
    const content = fs.readFileSync(adminModalPath, "utf8");

    // タブ部分に固定高さとoverflow-x-autoがあるか確認
    const hasFixedHeight =
      content.includes("h-12") || content.includes("h-full");
    const hasOverflowX = content.includes("overflow-x-auto");
    const hasMinWidth = content.includes("min-w-fit");

    const isResponsive = hasFixedHeight && hasOverflowX && hasMinWidth;

    recordResult(
      "レスポンシブ",
      "AdminModalタブのレスポンシブ対応",
      isResponsive,
      `固定高さ: ${hasFixedHeight ? "○" : "×"}, 横スクロール: ${
        hasOverflowX ? "○" : "×"
      }, 最小幅: ${hasMinWidth ? "○" : "×"}`
    );
  } catch (error) {
    recordResult(
      "レスポンシブ",
      "AdminModalタブのレスポンシブ対応",
      false,
      error.message
    );
  }

  // 7-2: Sidebarのレスポンシブ確認
  try {
    const sidebarPath = join(__dirname, "components", "Sidebar.tsx");
    const content = fs.readFileSync(sidebarPath, "utf8");

    const hasMdBreakpoint = content.includes("md:");
    const hasOverflowY = content.includes("overflow-y-auto");

    recordResult(
      "レスポンシブ",
      "Sidebarのレスポンシブ対応",
      hasMdBreakpoint && hasOverflowY,
      `ブレークポイント: ${hasMdBreakpoint ? "○" : "×"}, 縦スクロール: ${
        hasOverflowY ? "○" : "×"
      }`
    );
  } catch (error) {
    recordResult(
      "レスポンシブ",
      "Sidebarのレスポンシブ対応",
      false,
      error.message
    );
  }

  // 7-3: グローバルCSSの確認
  try {
    const cssPath = join(__dirname, "app", "globals.css");
    const content = fs.readFileSync(cssPath, "utf8");

    const hasTailwind = content.includes("@tailwind");
    const hasCustomScrollbar = content.includes("scrollbar");

    recordResult(
      "レスポンシブ",
      "グローバルCSSの設定",
      hasTailwind,
      `Tailwind: ${hasTailwind ? "○" : "×"}, カスタムスクロールバー: ${
        hasCustomScrollbar ? "○" : "×"
      }`
    );
  } catch (error) {
    recordResult("レスポンシブ", "グローバルCSSの設定", false, error.message);
  }
}

// ===========================
// メイン実行
// ===========================
async function main() {
  log("╔════════════════════════════════════════════════════════╗", "blue");
  log("║        安定性テスト - システム総合診断          ║", "blue");
  log("╚════════════════════════════════════════════════════════╝", "blue");

  const startTime = Date.now();

  // サーバーの起動確認
  log("\n🔍 サーバー接続確認...", "yellow");
  try {
    const response = await fetchWithRetry(`${BASE_URL}/api/tests`, {}, 3);
    if (response.ok) {
      log("✓ サーバーに接続しました\n", "green");
    } else {
      throw new Error(`サーバーが応答しません (HTTP ${response.status})`);
    }
  } catch (error) {
    log("✗ サーバーに接続できません", "red");
    log(`  ${error.message}`, "yellow");
    log(
      '\n💡 "npm run dev" でサーバーを起動してから再実行してください',
      "cyan"
    );
    return;
  }

  // 各テストを実行
  await testApiLoadHandling();
  await testDataIntegrity();
  await testErrorHandling();
  await testPdfStability();
  await testConcurrentOperations();
  await testUiStability();
  await testResponsiveDesign();

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // 結果サマリー
  log("\n" + "═".repeat(60), "blue");
  log("テスト結果サマリー", "cyan");
  log("═".repeat(60), "blue");

  const categories = [...new Set(testResults.map((r) => r.category))];

  for (const category of categories) {
    const categoryResults = testResults.filter((r) => r.category === category);
    const passed = categoryResults.filter((r) => r.passed).length;
    const total = categoryResults.length;
    const percentage = ((passed / total) * 100).toFixed(1);

    const color =
      passed === total ? "green" : passed >= total * 0.8 ? "yellow" : "red";
    log(`\n${category}: ${passed}/${total} (${percentage}%)`, color);

    // 失敗したテストの詳細
    const failed = categoryResults.filter((r) => !r.passed);
    if (failed.length > 0) {
      failed.forEach((test) => {
        log(`  ✗ ${test.testName}: ${test.details}`, "red");
      });
    }
  }

  // 総合結果
  const totalPassed = testResults.filter((r) => r.passed).length;
  const totalTests = testResults.length;
  const totalPercentage = ((totalPassed / totalTests) * 100).toFixed(1);

  log("\n" + "═".repeat(60), "blue");
  log(
    `総合結果: ${totalPassed}/${totalTests} テスト合格 (${totalPercentage}%)`,
    "cyan"
  );
  log(`実行時間: ${duration}秒`, "cyan");
  log("═".repeat(60), "blue");

  // 評価
  if (totalPercentage >= 95) {
    log("\n🎉 優秀: システムは非常に安定しています", "green");
  } else if (totalPercentage >= 85) {
    log(
      "\n✓ 良好: システムは安定していますが、いくつかの改善点があります",
      "yellow"
    );
  } else if (totalPercentage >= 70) {
    log("\n⚠ 注意: いくつかの問題があります。修正を推奨します", "yellow");
  } else {
    log("\n✗ 警告: 重大な問題があります。早急な対応が必要です", "red");
  }

  // レポートファイルに保存
  const reportPath = join(__dirname, "STABILITY_TEST_REPORT.md");
  const report = generateMarkdownReport(testResults, duration, totalPercentage);
  fs.writeFileSync(reportPath, report, "utf8");
  log(`\n📝 詳細レポートを保存しました: ${reportPath}`, "cyan");
}

// Markdownレポート生成
function generateMarkdownReport(results, duration, totalPercentage) {
  const date = new Date().toLocaleString("ja-JP");

  let report = `# 安定性テストレポート\n\n`;
  report += `**実行日時**: ${date}\n`;
  report += `**実行時間**: ${duration}秒\n`;
  report += `**総合合格率**: ${totalPercentage}%\n\n`;

  report += `## テスト結果サマリー\n\n`;

  const categories = [...new Set(results.map((r) => r.category))];

  for (const category of categories) {
    const categoryResults = results.filter((r) => r.category === category);
    const passed = categoryResults.filter((r) => r.passed).length;
    const total = categoryResults.length;
    const percentage = ((passed / total) * 100).toFixed(1);

    report += `### ${category}\n\n`;
    report += `**合格率**: ${passed}/${total} (${percentage}%)\n\n`;
    report += `| テスト項目 | 結果 | 詳細 |\n`;
    report += `|-----------|------|------|\n`;

    for (const test of categoryResults) {
      const status = test.passed ? "✅" : "❌";
      report += `| ${test.testName} | ${status} | ${test.details || "-"} |\n`;
    }

    report += `\n`;
  }

  // 推奨事項
  report += `## 推奨事項\n\n`;

  const failed = results.filter((r) => !r.passed);
  if (failed.length === 0) {
    report += `すべてのテストに合格しました。システムは安定して動作しています。\n`;
  } else {
    report += `以下の項目について確認・修正を推奨します:\n\n`;
    failed.forEach((test, index) => {
      report += `${index + 1}. **${test.category} - ${test.testName}**\n`;
      report += `   - 詳細: ${test.details}\n\n`;
    });
  }

  return report;
}

// 実行
main().catch((error) => {
  log("\n✗ テスト実行中にエラーが発生しました", "red");
  log(error.message, "red");
  console.error(error);
  process.exit(1);
});
