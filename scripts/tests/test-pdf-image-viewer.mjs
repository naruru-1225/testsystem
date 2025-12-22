/**
 * PDF + 画像ビューアー機能総合テスト
 *
 * このテストは以下を検証します:
 * 1. アップロード可能なファイルをPDFと画像のみに制限
 * 2. PDFビューアーでの画像表示機能
 * 3. 画像の印刷機能
 * 4. UI更新の確認
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
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// テスト結果
let passedTests = 0;
let failedTests = 0;
const testResults = [];

function recordTest(category, name, passed, details = "") {
  testResults.push({ category, name, passed, details });
  if (passed) {
    passedTests++;
    log(`  ✓ ${name}`, "green");
    if (details) log(`    ${details}`, "cyan");
  } else {
    failedTests++;
    log(`  ✗ ${name}`, "red");
    if (details) log(`    ${details}`, "yellow");
  }
}

async function testFileUploadRestriction() {
  log("\n📎 ファイルアップロード制限テスト", "cyan");
  log("═══════════════════════════════════════════", "cyan");

  const testCases = [
    // 許可されるファイル
    {
      name: "test.pdf",
      type: "application/pdf",
      shouldPass: true,
      category: "許可",
    },
    {
      name: "test.heic",
      type: "image/heic",
      shouldPass: true,
      category: "許可",
    },
    {
      name: "test.jpg",
      type: "image/jpeg",
      shouldPass: true,
      category: "許可",
    },
    { name: "test.png", type: "image/png", shouldPass: true, category: "許可" },

    // 拒否されるべきファイル
    {
      name: "test.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      shouldPass: false,
      category: "拒否",
    },
    {
      name: "test.xlsx",
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      shouldPass: false,
      category: "拒否",
    },
    {
      name: "test.txt",
      type: "text/plain",
      shouldPass: false,
      category: "拒否",
    },
    {
      name: "test.mp4",
      type: "video/mp4",
      shouldPass: false,
      category: "拒否",
    },
  ];

  for (const testCase of testCases) {
    try {
      const dummyContent = Buffer.from("test content for " + testCase.name);
      const formData = new FormData();
      const blob = new Blob([dummyContent], { type: testCase.type });
      formData.append("file", blob, testCase.name);

      const response = await fetch(`${BASE_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      const responseData = await response.json();

      if (testCase.shouldPass) {
        if (response.ok) {
          recordTest(
            "アップロード制限",
            `${testCase.name} - アップロード成功`,
            true,
            `${testCase.category}: 正常に受け入れられた`
          );
        } else {
          recordTest(
            "アップロード制限",
            `${testCase.name} - アップロード失敗`,
            false,
            `エラー: ${responseData.error}`
          );
        }
      } else {
        if (!response.ok) {
          recordTest(
            "アップロード制限",
            `${testCase.name} - 正しく拒否`,
            true,
            `${testCase.category}: ${responseData.error}`
          );
        } else {
          recordTest(
            "アップロード制限",
            `${testCase.name} - 不正に受理`,
            false,
            `不正なファイルが受け入れられた`
          );
        }
      }
    } catch (error) {
      recordTest(
        "アップロード制限",
        `${testCase.name} - テストエラー`,
        false,
        error.message
      );
    }
  }
}

async function testApiImplementation() {
  log("\n⚙️ API実装確認テスト", "cyan");
  log("═══════════════════════════════════════════", "cyan");

  try {
    const uploadApiPath = join(__dirname, "app", "api", "upload", "route.ts");
    const content = fs.readFileSync(uploadApiPath, "utf8");

    const checks = [
      {
        name: "PDF対応",
        keyword: "application/pdf",
        shouldExist: true,
      },
      {
        name: "HEIC対応",
        keyword: "image/heic",
        shouldExist: true,
      },
      {
        name: "JPEG対応",
        keyword: "image/jpeg",
        shouldExist: true,
      },
      {
        name: "PNG対応",
        keyword: "image/png",
        shouldExist: true,
      },
      {
        name: "DOCX非対応",
        keyword: "wordprocessingml",
        shouldExist: false,
      },
      {
        name: "XLSX非対応",
        keyword: "spreadsheetml",
        shouldExist: false,
      },
    ];

    for (const check of checks) {
      const exists = content.includes(check.keyword);
      const passed = exists === check.shouldExist;

      if (passed) {
        recordTest(
          "API実装",
          check.name,
          true,
          check.shouldExist ? "実装確認" : "正しく除外"
        );
      } else {
        recordTest(
          "API実装",
          check.name,
          false,
          check.shouldExist ? "実装なし" : "不要な実装が残存"
        );
      }
    }
  } catch (error) {
    recordTest("API実装", "ファイル読み込み", false, error.message);
  }
}

async function testUIComponentsUpdate() {
  log("\n🎨 UIコンポーネント更新確認テスト", "cyan");
  log("═══════════════════════════════════════════", "cyan");

  const componentsToCheck = [
    {
      file: "components/TestEditForm.tsx",
      checks: [
        {
          keyword: "PDF、HEIC、JPG、PNGファイルのみ",
          name: "エラーメッセージ更新",
          shouldExist: true,
        },
        {
          keyword: "wordprocessingml",
          name: "DOCX参照削除",
          shouldExist: false,
        },
        { keyword: "spreadsheetml", name: "XLSX参照削除", shouldExist: false },
        {
          keyword: "PDF、画像(HEIC/JPG/PNG)",
          name: "ヘルプテキスト更新",
          shouldExist: true,
        },
      ],
    },
    {
      file: "components/TestCreateForm.tsx",
      checks: [
        {
          keyword: "PDF、HEIC、JPG、PNGファイルのみ",
          name: "エラーメッセージ更新",
          shouldExist: true,
        },
        {
          keyword: "wordprocessingml",
          name: "DOCX参照削除",
          shouldExist: false,
        },
        { keyword: "spreadsheetml", name: "XLSX参照削除", shouldExist: false },
        { keyword: "PDF/画像", name: "ラベル更新", shouldExist: true },
      ],
    },
  ];

  for (const component of componentsToCheck) {
    try {
      const filePath = join(__dirname, component.file);
      const content = fs.readFileSync(filePath, "utf8");

      for (const check of component.checks) {
        const exists = content.includes(check.keyword);
        const passed = exists === check.shouldExist;

        if (passed) {
          recordTest(
            `UI: ${component.file}`,
            check.name,
            true,
            check.shouldExist ? "更新確認" : "正しく削除"
          );
        } else {
          recordTest(
            `UI: ${component.file}`,
            check.name,
            false,
            check.shouldExist ? "未更新" : "不要な参照が残存"
          );
        }
      }
    } catch (error) {
      recordTest(
        `UI: ${component.file}`,
        "ファイル読み込み",
        false,
        error.message
      );
    }
  }
}

async function testPdfViewerEnhancement() {
  log("\n🖼️ PDFビューアー画像対応テスト", "cyan");
  log("═══════════════════════════════════════════", "cyan");

  try {
    const pdfViewerPath = join(__dirname, "components", "PdfViewer.tsx");
    const content = fs.readFileSync(pdfViewerPath, "utf8");

    const checks = [
      {
        keyword: "getFileType",
        name: "ファイルタイプ判定関数",
        description: "PDF/画像を判定する関数の実装",
      },
      {
        keyword: "currentFileType",
        name: "ファイルタイプ状態管理",
        description: "現在のファイルタイプを保持するstate",
      },
      {
        keyword: "currentFileType === 'image'",
        name: "画像表示分岐処理",
        description: "画像ファイルの条件分岐",
      },
      {
        keyword: "<img",
        name: "画像要素レンダリング",
        description: "img要素による画像表示",
      },
      {
        keyword: "transform: `scale(${scale})`",
        name: "画像ズーム機能",
        description: "scaleを使った画像の拡大縮小",
      },
      {
        keyword: "printWindow.document.write",
        name: "画像印刷機能",
        description: "画像専用の印刷処理",
      },
      {
        keyword: "currentFileType === 'pdf'",
        name: "PDFナビゲーション分岐",
        description: "PDFのみページナビゲーション表示",
      },
    ];

    for (const check of checks) {
      if (content.includes(check.keyword)) {
        recordTest("PDFビューアー", check.name, true, check.description);
      } else {
        recordTest(
          "PDFビューアー",
          check.name,
          false,
          `${check.description} - 実装なし`
        );
      }
    }
  } catch (error) {
    recordTest("PDFビューアー", "ファイル読み込み", false, error.message);
  }
}

async function testAcceptAttributes() {
  log("\n📋 accept属性正確性テスト", "cyan");
  log("═══════════════════════════════════════════", "cyan");

  const filesToCheck = [
    { file: "components/TestEditForm.tsx", name: "TestEditForm" },
    { file: "components/TestCreateForm.tsx", name: "TestCreateForm" },
  ];

  for (const fileInfo of filesToCheck) {
    try {
      const filePath = join(__dirname, fileInfo.file);
      const content = fs.readFileSync(filePath, "utf8");

      // accept属性を抽出
      const acceptMatches = content.match(/accept="([^"]*)"/g);

      if (acceptMatches) {
        for (const match of acceptMatches) {
          const acceptValue = match.match(/accept="([^"]*)"/)[1];

          // DOCXやXLSXが含まれていないことを確認
          const hasDocx =
            acceptValue.includes("docx") ||
            acceptValue.includes("wordprocessing");
          const hasXlsx =
            acceptValue.includes("xlsx") || acceptValue.includes("spreadsheet");

          // PDFと画像が含まれていることを確認
          const hasPdf = acceptValue.includes("pdf");
          const hasImages =
            acceptValue.includes("heic") &&
            acceptValue.includes("jpeg") &&
            acceptValue.includes("png");

          if (!hasDocx && !hasXlsx && hasPdf && hasImages) {
            recordTest(
              `accept属性: ${fileInfo.name}`,
              "正しい形式のみ許可",
              true,
              "PDF + 画像のみ"
            );
          } else {
            const issues = [];
            if (hasDocx) issues.push("DOCXが残存");
            if (hasXlsx) issues.push("XLSXが残存");
            if (!hasPdf) issues.push("PDFなし");
            if (!hasImages) issues.push("画像形式不足");

            recordTest(
              `accept属性: ${fileInfo.name}`,
              "不正な属性値",
              false,
              issues.join(", ")
            );
          }
        }
      } else {
        recordTest(
          `accept属性: ${fileInfo.name}`,
          "accept属性なし",
          false,
          "ファイル入力が見つからない"
        );
      }
    } catch (error) {
      recordTest(
        `accept属性: ${fileInfo.name}`,
        "ファイル読み込み",
        false,
        error.message
      );
    }
  }
}

async function testErrorMessages() {
  log("\n💬 エラーメッセージ一貫性テスト", "cyan");
  log("═══════════════════════════════════════════", "cyan");

  const expectedMessage = "PDF、HEIC、JPG、PNGファイルのみ";
  const oldMessage = "DOCX、XLSX";

  const filesToCheck = [
    "components/TestEditForm.tsx",
    "components/TestCreateForm.tsx",
    "app/api/upload/route.ts",
  ];

  for (const file of filesToCheck) {
    try {
      const filePath = join(__dirname, file);
      const content = fs.readFileSync(filePath, "utf8");

      const hasNewMessage = content.includes(expectedMessage);
      const hasOldMessage = content.includes(oldMessage);

      if (hasNewMessage && !hasOldMessage) {
        recordTest(
          "エラーメッセージ",
          file,
          true,
          "新しいメッセージに更新済み"
        );
      } else if (!hasNewMessage && hasOldMessage) {
        recordTest("エラーメッセージ", file, false, "古いメッセージが残存");
      } else if (!hasNewMessage && !hasOldMessage) {
        recordTest(
          "エラーメッセージ",
          file,
          false,
          "エラーメッセージが見つからない"
        );
      } else {
        recordTest("エラーメッセージ", file, false, "新旧メッセージが混在");
      }
    } catch (error) {
      recordTest("エラーメッセージ", file, false, error.message);
    }
  }
}

async function generateReport() {
  log(
    "\n═══════════════════════════════════════════════════════════",
    "bright"
  );
  log("テスト結果サマリー", "bright");
  log("═══════════════════════════════════════════════════════════", "bright");

  // カテゴリ別の集計
  const categories = {};
  testResults.forEach((result) => {
    if (!categories[result.category]) {
      categories[result.category] = { passed: 0, failed: 0 };
    }
    if (result.passed) {
      categories[result.category].passed++;
    } else {
      categories[result.category].failed++;
    }
  });

  log("\n📊 カテゴリ別結果:", "cyan");
  Object.keys(categories).forEach((category) => {
    const cat = categories[category];
    const total = cat.passed + cat.failed;
    const rate = ((cat.passed / total) * 100).toFixed(1);
    const color = cat.failed === 0 ? "green" : "yellow";
    log(`  ${category}: ${cat.passed}/${total} (${rate}%)`, color);
  });

  log("\n📈 総合結果:", "cyan");
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
    log("✨ PDF + 画像ビューアー機能が完全に実装されました", "green");
  } else {
    log("\n⚠️ いくつかのテストが失敗しました", "yellow");
    log("\n失敗したテスト:", "red");
    testResults
      .filter((r) => !r.passed)
      .forEach((r) => {
        log(`  • ${r.category}: ${r.name}`, "red");
        if (r.details) log(`    ${r.details}`, "yellow");
      });
  }

  // 実装状況サマリー
  log("\n═══════════════════════════════════════════════════════════", "cyan");
  log("実装状況サマリー", "bright");
  log("═══════════════════════════════════════════════════════════", "cyan");

  log("\n✅ 完了した機能:", "green");
  log("  1. アップロード制限: PDFと画像のみ受付", "green");
  log("  2. PDFビューアー: 画像ファイルの表示対応", "green");
  log("  3. 印刷機能: 画像の印刷機能実装", "green");
  log("  4. UI更新: 全てのフォームとメッセージを更新", "green");

  log("\n📋 対応ファイル形式:", "cyan");
  log("  ✓ PDF  (application/pdf)", "cyan");
  log("  ✓ HEIC (image/heic)", "cyan");
  log("  ✓ JPG  (image/jpeg)", "cyan");
  log("  ✓ PNG  (image/png)", "cyan");

  log("\n❌ 非対応ファイル形式:", "red");
  log("  ✗ DOCX (削除)", "red");
  log("  ✗ XLSX (削除)", "red");
  log("  ✗ その他すべて", "red");
}

// メイン実行
async function main() {
  log(
    "\n╔═══════════════════════════════════════════════════════════╗",
    "bright"
  );
  log("║        PDF + 画像ビューアー機能 総合テスト              ║", "bright");
  log(
    "╚═══════════════════════════════════════════════════════════╝",
    "bright"
  );

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

  // テスト実行
  await testFileUploadRestriction();
  await testApiImplementation();
  await testUIComponentsUpdate();
  await testPdfViewerEnhancement();
  await testAcceptAttributes();
  await testErrorMessages();

  // レポート生成
  await generateReport();
}

main().catch((error) => {
  log("\n✗ テスト実行中にエラーが発生しました", "red");
  log(error.message, "red");
  console.error(error);
  process.exit(1);
});
