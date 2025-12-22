/**
 * マルチフォーマットファイルアップロード機能テスト
 *
 * このテストは以下を検証します:
 * 1. 複数ファイル形式のアップロード（PDF, HEIC, JPG, PNG, DOCX, XLSX）
 * 2. ダッシュボードAPIの動作確認
 * 3. UI表示の確認
 */

import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(dirname(__filename), "../..");

const BASE_URL = "http://localhost:3000";

// カラー出力設定
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bright: "\x1b[1m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// テスト結果
let passedTests = 0;
let failedTests = 0;

async function testMultiFormatUpload() {
  log(
    "\n╔════════════════════════════════════════════════════════════╗",
    "bright"
  );
  log("║     マルチフォーマットファイルアップロード機能テスト     ║", "bright");
  log(
    "╚════════════════════════════════════════════════════════════╝",
    "bright"
  );

  // 1. ダッシュボードAPIテスト
  log("\n📊 ダッシュボードAPI動作確認", "cyan");
  try {
    const response = await fetch(`${BASE_URL}/api/stats/summary`);
    if (response.ok) {
      const stats = await response.json();
      log("  ✓ ダッシュボードAPIが正常に動作", "green");
      log(`    - 総テスト数: ${stats.overview.totalTests}`, "cyan");
      log(`    - PDFあり: ${stats.overview.testsWithPdf}`, "cyan");
      log(`    - PDFなし: ${stats.overview.testsWithoutPdf}`, "cyan");
      passedTests++;
    } else {
      log(`  ✗ ダッシュボードAPI失敗: HTTP ${response.status}`, "red");
      failedTests++;
    }
  } catch (error) {
    log(`  ✗ ダッシュボードAPIエラー: ${error.message}`, "red");
    failedTests++;
  }

  // 2. ダッシュボードページアクセステスト
  log("\n🌐 ダッシュボードページアクセス確認", "cyan");
  try {
    const response = await fetch(`${BASE_URL}/dashboard`);
    if (response.ok) {
      const html = await response.text();
      if (html.includes("ダッシュボード") || html.includes("dashboard")) {
        log("  ✓ ダッシュボードページが正常に表示", "green");
        passedTests++;
      } else {
        log("  ✗ ダッシュボードページの内容が不正", "red");
        failedTests++;
      }
    } else {
      log(`  ✗ ダッシュボードページ失敗: HTTP ${response.status}`, "red");
      failedTests++;
    }
  } catch (error) {
    log(`  ✗ ダッシュボードページエラー: ${error.message}`, "red");
    failedTests++;
  }

  // 3. アップロードAPI許可形式チェック
  log("\n📎 アップロードAPI対応形式確認", "cyan");
  const testFiles = [
    { name: "test.pdf", type: "application/pdf", shouldPass: true },
    { name: "test.heic", type: "image/heic", shouldPass: true },
    { name: "test.jpg", type: "image/jpeg", shouldPass: true },
    { name: "test.png", type: "image/png", shouldPass: true },
    {
      name: "test.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      shouldPass: true,
    },
    {
      name: "test.xlsx",
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      shouldPass: true,
    },
    { name: "test.txt", type: "text/plain", shouldPass: false },
  ];

  for (const testFile of testFiles) {
    try {
      // 小さなダミーファイルを作成
      const dummyContent = Buffer.from("test content");
      const formData = new FormData();
      const blob = new Blob([dummyContent], { type: testFile.type });
      formData.append("file", blob, testFile.name);

      const response = await fetch(`${BASE_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (testFile.shouldPass) {
        if (response.ok) {
          log(
            `  ✓ ${testFile.name} (${testFile.type}) - アップロード成功`,
            "green"
          );
          passedTests++;
        } else {
          const errorData = await response.json();
          log(
            `  ✗ ${testFile.name} - アップロード失敗: ${errorData.error}`,
            "red"
          );
          failedTests++;
        }
      } else {
        if (!response.ok) {
          log(`  ✓ ${testFile.name} - 正しく拒否されました`, "green");
          passedTests++;
        } else {
          log(
            `  ✗ ${testFile.name} - 不正なファイルが受け入れられました`,
            "red"
          );
          failedTests++;
        }
      }
    } catch (error) {
      log(`  ✗ ${testFile.name} - テストエラー: ${error.message}`, "red");
      failedTests++;
    }
  }

  // 4. UIコンポーネント確認
  log("\n🎨 UIコンポーネント実装確認", "cyan");
  const componentsToCheck = [
    {
      file: "components/TestEditForm.tsx",
      keywords: ["HEIC", "DOCX", "XLSX", "allowedTypes"],
    },
    {
      file: "components/TestCreateForm.tsx",
      keywords: ["HEIC", "DOCX", "XLSX", "allowedTypes"],
    },
  ];

  for (const component of componentsToCheck) {
    try {
      const filePath = join(__dirname, component.file);
      const content = fs.readFileSync(filePath, "utf8");

      let allKeywordsFound = true;
      const missingKeywords = [];

      for (const keyword of component.keywords) {
        if (!content.includes(keyword)) {
          allKeywordsFound = false;
          missingKeywords.push(keyword);
        }
      }

      if (allKeywordsFound) {
        log(`  ✓ ${component.file} - マルチフォーマット対応実装確認`, "green");
        passedTests++;
      } else {
        log(
          `  ✗ ${component.file} - 実装不足: ${missingKeywords.join(", ")}`,
          "red"
        );
        failedTests++;
      }
    } catch (error) {
      log(`  ✗ ${component.file} - 確認エラー: ${error.message}`, "red");
      failedTests++;
    }
  }

  // 5. データベーススキーマ確認
  log("\n🗄️ データベーススキーマ確認", "cyan");
  try {
    const dbPath = join(__dirname, "lib", "database.ts");
    const content = fs.readFileSync(dbPath, "utf8");

    const hasMultiFormat =
      content.includes("mime_type") && content.includes("file_size");

    if (hasMultiFormat) {
      log(
        "  ✓ データベーススキーマにmime_type, file_sizeカラムが存在",
        "green"
      );
      passedTests++;
    } else {
      log("  ✗ データベーススキーマが更新されていません", "red");
      failedTests++;
    }
  } catch (error) {
    log(`  ✗ データベーススキーマ確認エラー: ${error.message}`, "red");
    failedTests++;
  }

  // 6. アップロードAPI実装確認
  log("\n⚙️ アップロードAPI実装確認", "cyan");
  try {
    const uploadApiPath = join(__dirname, "app", "api", "upload", "route.ts");
    const content = fs.readFileSync(uploadApiPath, "utf8");

    const checks = [
      { name: "HEIC対応", keyword: "image/heic" },
      { name: "DOCX対応", keyword: "wordprocessingml" },
      { name: "XLSX対応", keyword: "spreadsheetml" },
      { name: "mime_type保存", keyword: "mime_type" },
      { name: "file_size保存", keyword: "file_size" },
    ];

    for (const check of checks) {
      if (content.includes(check.keyword)) {
        log(`  ✓ ${check.name} - 実装確認`, "green");
        passedTests++;
      } else {
        log(`  ✗ ${check.name} - 実装なし`, "red");
        failedTests++;
      }
    }
  } catch (error) {
    log(`  ✗ アップロードAPI確認エラー: ${error.message}`, "red");
    failedTests++;
  }

  // 結果サマリー
  log("\n═══════════════════════════════════════════════════════════", "cyan");
  log("テスト結果サマリー", "bright");
  log("═══════════════════════════════════════════════════════════", "cyan");
  log(`総テスト数: ${passedTests + failedTests}`, "cyan");
  log(`合格: ${passedTests}`, "green");
  log(`不合格: ${failedTests}`, failedTests > 0 ? "red" : "green");
  log(
    `合格率: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(
      1
    )}%`,
    failedTests === 0 ? "green" : "yellow"
  );

  if (failedTests === 0) {
    log("\n🎉 全てのテストに合格しました！", "green");
  } else {
    log("\n⚠️ いくつかのテストが失敗しました", "yellow");
  }
}

// メイン実行
async function main() {
  // サーバー接続確認
  log("\n🔍 サーバー接続確認中...", "yellow");
  try {
    const response = await fetch(`${BASE_URL}/api/tests`, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      log("✓ サーバーに接続成功\n", "green");
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

  await testMultiFormatUpload();
}

main().catch((error) => {
  log("\n✗ テスト実行中にエラーが発生しました", "red");
  log(error.message, "red");
  console.error(error);
  process.exit(1);
});
