/**
 * iPad PDF閲覧エラー診断テスト
 * 特定のiPadでのPDF.js読み込み失敗を診断
 */

import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), "../..");

const API_BASE = "http://localhost:3000";

// カラーコード
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function log(emoji, message, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

function section(title) {
  console.log(
    `\n${colors.cyan}${colors.bright}${"=".repeat(70)}${colors.reset}`
  );
  console.log(`${colors.cyan}${colors.bright}${title}${colors.reset}`);
  console.log(
    `${colors.cyan}${colors.bright}${"=".repeat(70)}${colors.reset}\n`
  );
}

// テスト結果を記録
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function pass(name, detail = "") {
  results.passed++;
  results.tests.push({ name, status: "pass", detail });
  log("✅", `${name}${detail ? ": " + detail : ""}`, colors.green);
}

function fail(name, detail = "") {
  results.failed++;
  results.tests.push({ name, status: "fail", detail });
  log("❌", `${name}${detail ? ": " + detail : ""}`, colors.red);
}

function info(message) {
  log("ℹ️", message, colors.blue);
}

function warn(message) {
  log("⚠️", message, colors.yellow);
}

// サーバー接続確認
async function checkServer() {
  try {
    const response = await fetch(API_BASE);
    if (response.ok) {
      pass("サーバー接続確認", `${API_BASE}`);
      return true;
    }
  } catch (error) {
    fail("サーバー接続確認", error.message);
    return false;
  }
}

// 1. PDF.js Worker ファイル確認
section("🔧 PDF.js Worker ファイル確認");

async function testPdfWorker() {
  info("PDF.js workerファイルの存在と内容を確認");

  const workerPath = path.join(
    process.cwd(),
    "public",
    "pdfjs",
    "pdf.worker.min.mjs"
  );

  if (!existsSync(workerPath)) {
    fail("Workerファイル存在確認", "ファイルが見つかりません");
    return;
  }

  pass("Workerファイル存在確認", workerPath);

  try {
    const stats = readFileSync(workerPath);
    const sizeKB = (stats.length / 1024).toFixed(2);
    pass("Workerファイルサイズ", `${sizeKB} KB`);

    // API経由でアクセス可能か確認
    const workerUrl = `${API_BASE}/pdfjs/pdf.worker.min.mjs`;
    const response = await fetch(workerUrl);

    if (response.ok) {
      const contentType = response.headers.get("content-type");
      pass("Worker HTTP アクセス", `${workerUrl}`);
      info(`Content-Type: ${contentType}`);

      if (
        !contentType?.includes("javascript") &&
        !contentType?.includes("application/octet-stream")
      ) {
        warn("Content-Typeが適切でない可能性があります");
      }
    } else {
      fail("Worker HTTP アクセス", `HTTP ${response.status}`);
    }
  } catch (error) {
    fail("Workerファイル確認", error.message);
  }
}

// 2. PDF ファイルアクセステスト
section("📄 PDFファイルアクセステスト");

async function testPdfAccess() {
  info("問題のPDFファイルへのアクセスをテスト");

  const testPdfPath = "/api/pdf/pdfs/1762257539971-mhjhvtzhf7k.pdf";
  const fullUrl = `${API_BASE}${testPdfPath}`;

  try {
    const response = await fetch(fullUrl);

    if (response.ok) {
      const contentType = response.headers.get("content-type");
      const contentLength = response.headers.get("content-length");
      const cors = response.headers.get("access-control-allow-origin");

      pass("PDFファイルアクセス", fullUrl);
      info(`Content-Type: ${contentType}`);
      info(
        `Content-Length: ${contentLength} bytes (${(
          parseInt(contentLength) / 1024
        ).toFixed(2)} KB)`
      );
      info(`CORS Header: ${cors || "なし"}`);

      if (contentType !== "application/pdf") {
        warn(`Content-Typeが期待と異なります: ${contentType}`);
      }

      if (!cors || cors === "null") {
        warn("CORSヘッダーが設定されていません");
      }

      // 実際にデータを取得
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // PDFマジックナンバー確認 (%PDF-)
      if (
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46
      ) {
        pass("PDFファイル形式確認", "マジックナンバー: %PDF");
      } else {
        fail(
          "PDFファイル形式確認",
          `マジックナンバー不一致: ${bytes.slice(0, 4).join(",")}`
        );
      }

      // PDFバージョン確認
      const header = String.fromCharCode(...bytes.slice(0, 8));
      info(`PDFヘッダー: ${header}`);
    } else {
      fail("PDFファイルアクセス", `HTTP ${response.status}`);
    }
  } catch (error) {
    fail("PDFファイルアクセス", error.message);
  }
}

// 3. CORS ヘッダー確認
section("🌐 CORS ヘッダー確認");

async function testCorsHeaders() {
  info("PDFとWorkerのCORSヘッダーを確認");

  const endpoints = [
    "/pdfjs/pdf.worker.min.mjs",
    "/api/pdf/pdfs/1762257539971-mhjhvtzhf7k.pdf",
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "OPTIONS",
      });

      const headers = {
        "Access-Control-Allow-Origin": response.headers.get(
          "access-control-allow-origin"
        ),
        "Access-Control-Allow-Methods": response.headers.get(
          "access-control-allow-methods"
        ),
        "Access-Control-Allow-Headers": response.headers.get(
          "access-control-allow-headers"
        ),
      };

      pass("OPTIONS リクエスト", endpoint);
      console.log("  CORS Headers:", JSON.stringify(headers, null, 2));

      if (!headers["Access-Control-Allow-Origin"]) {
        warn("  Access-Control-Allow-Origin が設定されていません");
      }
    } catch (error) {
      fail("OPTIONS リクエスト", `${endpoint}: ${error.message}`);
    }
  }
}

// 4. レスポンスヘッダー詳細確認
section("📋 レスポンスヘッダー詳細確認");

async function testResponseHeaders() {
  info("PDFファイルのすべてのレスポンスヘッダーを確認");

  const testPdfPath = "/api/pdf/pdfs/1762257539971-mhjhvtzhf7k.pdf";
  const fullUrl = `${API_BASE}${testPdfPath}`;

  try {
    const response = await fetch(fullUrl);

    if (response.ok) {
      pass("レスポンス取得", fullUrl);

      console.log("\n  すべてのレスポンスヘッダー:");
      response.headers.forEach((value, key) => {
        console.log(`    ${key}: ${value}`);
      });

      // 重要なヘッダーの確認
      const importantHeaders = [
        "content-type",
        "content-length",
        "content-disposition",
        "cache-control",
        "access-control-allow-origin",
        "access-control-allow-methods",
        "accept-ranges",
      ];

      console.log("\n  重要なヘッダーの確認:");
      importantHeaders.forEach((header) => {
        const value = response.headers.get(header);
        if (value) {
          console.log(`    ✅ ${header}: ${value}`);
        } else {
          console.log(`    ⚠️  ${header}: (なし)`);
        }
      });
    } else {
      fail("レスポンス取得", `HTTP ${response.status}`);
    }
  } catch (error) {
    fail("レスポンス取得", error.message);
  }
}

// 5. ファイルサイズとパフォーマンステスト
section("⚡ ファイルサイズとパフォーマンステスト");

async function testPerformance() {
  info("PDFファイルのダウンロード速度を測定");

  const testPdfPath = "/api/pdf/pdfs/1762257539971-mhjhvtzhf7k.pdf";
  const fullUrl = `${API_BASE}${testPdfPath}`;

  try {
    const startTime = Date.now();
    const response = await fetch(fullUrl);
    const buffer = await response.arrayBuffer();
    const endTime = Date.now();

    const sizeKB = buffer.byteLength / 1024;
    const timeSec = (endTime - startTime) / 1000;
    const speedKBps = sizeKB / timeSec;

    pass(
      "ダウンロード完了",
      `${sizeKB.toFixed(2)} KB in ${timeSec.toFixed(2)}秒`
    );
    info(`速度: ${speedKBps.toFixed(2)} KB/s`);

    if (sizeKB > 10240) {
      // 10MB
      warn("ファイルサイズが大きすぎる可能性があります (>10MB)");
    }

    if (timeSec > 5) {
      warn("ダウンロードに時間がかかりすぎています (>5秒)");
    }
  } catch (error) {
    fail("パフォーマンステスト", error.message);
  }
}

// 6. Range リクエスト対応確認
section("📦 Range リクエスト対応確認");

async function testRangeRequests() {
  info("部分的なコンテンツ取得が可能か確認 (iPad Safari重要)");

  const testPdfPath = "/api/pdf/pdfs/1762257539971-mhjhvtzhf7k.pdf";
  const fullUrl = `${API_BASE}${testPdfPath}`;

  try {
    // Rangeリクエストを送信
    const response = await fetch(fullUrl, {
      headers: {
        Range: "bytes=0-1023", // 最初の1KBを要求
      },
    });

    const status = response.status;
    const contentRange = response.headers.get("content-range");
    const acceptRanges = response.headers.get("accept-ranges");

    if (status === 206) {
      pass("Range リクエスト対応", `HTTP 206 Partial Content`);
      info(`Content-Range: ${contentRange}`);
      info(`Accept-Ranges: ${acceptRanges}`);
    } else if (status === 200) {
      warn(
        "Range リクエスト非対応",
        `HTTP 200 (全体を返却) - iPadで問題になる可能性`
      );
      info(`Accept-Ranges: ${acceptRanges || "なし"}`);
    } else {
      fail("Range リクエスト", `HTTP ${status}`);
    }
  } catch (error) {
    fail("Range リクエストテスト", error.message);
  }
}

// 7. メモリ使用量推定
section("💾 メモリ使用量推定");

async function testMemoryEstimate() {
  info("PDFファイルのメモリ使用量を推定");

  const testPdfPath = "/api/pdf/pdfs/1762257539971-mhjhvtzhf7k.pdf";
  const fullUrl = `${API_BASE}${testPdfPath}`;

  try {
    const response = await fetch(fullUrl);
    const buffer = await response.arrayBuffer();
    const sizeBytes = buffer.byteLength;
    const sizeMB = sizeBytes / (1024 * 1024);

    // PDF.jsは通常、ファイルサイズの3-5倍のメモリを使用
    const estimatedMemoryMB = sizeMB * 4;

    pass("メモリ使用量推定", `ファイルサイズ: ${sizeMB.toFixed(2)} MB`);
    info(`推定メモリ使用量: ${estimatedMemoryMB.toFixed(2)} MB`);

    if (estimatedMemoryMB > 100) {
      warn("メモリ使用量が多すぎます - iPadでメモリ不足の可能性");
    } else if (estimatedMemoryMB > 50) {
      warn("メモリ使用量がやや多い - 古いiPadで問題になる可能性");
    }
  } catch (error) {
    fail("メモリ推定", error.message);
  }
}

// メイン実行
async function main() {
  console.log(
    `\n${colors.bright}${colors.magenta}╔════════════════════════════════════════════════════════════╗${colors.reset}`
  );
  console.log(
    `${colors.bright}${colors.magenta}║        iPad PDF閲覧エラー診断テスト - 詳細分析        ║${colors.reset}`
  );
  console.log(
    `${colors.bright}${colors.magenta}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`
  );

  // サーバー確認
  const serverOk = await checkServer();
  if (!serverOk) {
    log(
      "🛑",
      "サーバーが起動していません。npm run dev を実行してください。",
      colors.red
    );
    process.exit(1);
  }

  // テスト実行
  await testPdfWorker();
  await testPdfAccess();
  await testCorsHeaders();
  await testResponseHeaders();
  await testPerformance();
  await testRangeRequests();
  await testMemoryEstimate();

  // 結果サマリー
  console.log(
    `\n${colors.cyan}${colors.bright}${"=".repeat(70)}${colors.reset}`
  );
  console.log(
    `${colors.cyan}${colors.bright}テスト結果サマリー${colors.reset}`
  );
  console.log(
    `${colors.cyan}${colors.bright}${"=".repeat(70)}${colors.reset}\n`
  );

  const total = results.passed + results.failed;
  const passRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;

  log("📊", `総テスト数: ${total}`, colors.blue);
  log("✅", `合格: ${results.passed}`, colors.green);
  if (results.failed > 0) {
    log("❌", `不合格: ${results.failed}`, colors.red);
  } else {
    log("✅", `不合格: ${results.failed}`, colors.green);
  }
  log(
    "📈",
    `合格率: ${passRate}%`,
    passRate >= 90 ? colors.green : colors.yellow
  );

  // 診断結果と推奨事項
  console.log(
    `\n${colors.cyan}${colors.bright}診断結果と推奨事項${colors.reset}`
  );
  console.log(
    `${colors.cyan}${colors.bright}${"─".repeat(70)}${colors.reset}\n`
  );

  if (results.failed === 0) {
    log("🎉", "すべてのテストに合格しました！", colors.green);
    log("ℹ️", "iPadでのエラーは以下の原因が考えられます:", colors.blue);
    console.log("  1. iPadのSafariバージョンが古い");
    console.log("  2. iPadのメモリ不足");
    console.log("  3. iPadのキャッシュが破損");
    console.log("  4. ネットワークの不安定性");
    console.log("\n  推奨対処法:");
    console.log("  - Safariのキャッシュをクリア");
    console.log("  - iPadを再起動");
    console.log("  - 他のアプリを閉じてメモリを確保");
    console.log("  - Wi-Fi接続を確認");
  } else {
    log("⚠️", "一部のテストが失敗しました", colors.yellow);
    log("ℹ️", "失敗したテストを確認してください", colors.blue);
  }

  console.log();
}

main().catch(console.error);
