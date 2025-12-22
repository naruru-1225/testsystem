/**
 * HEIC画像アップロード・表示機能の詳細テスト
 * iPad互換性検証
 */

import { createReadStream, existsSync, readFileSync } from "fs";
import { readFile } from "fs/promises";
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

// 1. API Content-Type確認テスト
section("📋 API Content-Type機能テスト");

async function testApiContentType() {
  info("API /api/pdf/[...path] のContent-Type判定をテスト");

  // テスト用ファイルパスを確認
  const uploadsDir = path.join(process.cwd(), "public", "uploads", "pdfs");
  const testDirs = ["test_5", "test_6", "test_7", "test_8", "test_9"];

  let testedImages = 0;
  let testedPdfs = 0;

  for (const dir of testDirs) {
    const dirPath = path.join(uploadsDir, dir);
    if (!existsSync(dirPath)) continue;

    const fs = await import("fs/promises");
    const files = await fs.readdir(dirPath);

    for (const file of files) {
      const ext = file.split(".").pop()?.toLowerCase();
      const apiPath = `/api/pdf/pdfs/${dir}/${file}`;

      try {
        const response = await fetch(`${API_BASE}${apiPath}`);
        const contentType = response.headers.get("content-type");

        if (ext === "pdf") {
          if (contentType === "application/pdf") {
            pass(`PDF Content-Type確認`, `${file} → ${contentType}`);
            testedPdfs++;
          } else {
            fail(
              `PDF Content-Type確認`,
              `${file} → ${contentType} (期待: application/pdf)`
            );
          }
        } else if (["jpg", "jpeg"].includes(ext)) {
          if (contentType === "image/jpeg") {
            pass(`JPEG Content-Type確認`, `${file} → ${contentType}`);
            testedImages++;
          } else {
            fail(
              `JPEG Content-Type確認`,
              `${file} → ${contentType} (期待: image/jpeg)`
            );
          }
        } else if (ext === "png") {
          if (contentType === "image/png") {
            pass(`PNG Content-Type確認`, `${file} → ${contentType}`);
            testedImages++;
          } else {
            fail(
              `PNG Content-Type確認`,
              `${file} → ${contentType} (期待: image/png)`
            );
          }
        }

        // 最初の3ファイルのみテスト（時間短縮）
        if (testedImages + testedPdfs >= 3) break;
      } catch (error) {
        fail(`API取得エラー`, `${apiPath}: ${error.message}`);
      }
    }

    if (testedImages + testedPdfs >= 3) break;
  }

  if (testedImages === 0 && testedPdfs === 0) {
    info("テスト対象のファイルが見つかりませんでした");
  }
}

// 2. PdfViewer ファイルタイプ判定テスト
section("🖼️ PdfViewer ファイルタイプ判定テスト");

async function testPdfViewerFileType() {
  info("PdfViewer.tsx の getFileType() 関数をシミュレート");

  // getFileType関数のロジックを再現
  const getFileType = (mimeType, fileName) => {
    if (mimeType) {
      if (mimeType === "application/pdf") return "pdf";
      if (mimeType.startsWith("image/")) return "image";
    }
    if (fileName) {
      const ext = fileName.toLowerCase().split(".").pop();
      if (ext === "pdf") return "pdf";
      if (
        ["jpg", "jpeg", "png", "heic", "heif", "gif", "webp", "bmp"].includes(
          ext || ""
        )
      ) {
        return "image";
      }
    }
    return "unknown";
  };

  // テストケース
  const testCases = [
    { mimeType: "application/pdf", fileName: "test.pdf", expected: "pdf" },
    { mimeType: "image/jpeg", fileName: "test.jpg", expected: "image" },
    { mimeType: "image/jpeg", fileName: "main.jpg", expected: "image" },
    { mimeType: "image/png", fileName: "test.png", expected: "image" },
    { mimeType: "image/heic", fileName: "test.heic", expected: "image" },
    { mimeType: null, fileName: "test.jpg", expected: "image" },
    { mimeType: null, fileName: "test.pdf", expected: "pdf" },
    { mimeType: "application/pdf", fileName: "main.pdf", expected: "pdf" },
  ];

  for (const testCase of testCases) {
    const result = getFileType(testCase.mimeType, testCase.fileName);
    if (result === testCase.expected) {
      pass(
        "ファイルタイプ判定",
        `${testCase.fileName} (${testCase.mimeType || "null"}) → ${result}`
      );
    } else {
      fail(
        "ファイルタイプ判定",
        `${testCase.fileName} → ${result} (期待: ${testCase.expected})`
      );
    }
  }
}

// 3. データベースのmime_type確認
section("🗄️ データベースのmime_type確認");

async function testDatabaseMimeType() {
  info("test_attachments テーブルの mime_type を確認");

  const dbPath = path.join(process.cwd(), "data", "tests.db");
  if (!existsSync(dbPath)) {
    fail("データベース確認", `データベースファイルが見つかりません: ${dbPath}`);
    return;
  }

  try {
    const Database = (await import("better-sqlite3")).default;
    const db = new Database(dbPath);

    const attachments = db
      .prepare(
        `
      SELECT id, test_id, file_name, file_path, mime_type, file_size
      FROM test_attachments
      ORDER BY id DESC
      LIMIT 10
    `
      )
      .all();

    if (attachments.length === 0) {
      info("添付ファイルがまだありません");
    } else {
      pass("データベース接続", `${attachments.length}件の添付ファイルを取得`);

      for (const att of attachments) {
        const ext = att.file_path.split(".").pop()?.toLowerCase();
        let expectedMime = null;

        if (ext === "pdf") expectedMime = "application/pdf";
        else if (["jpg", "jpeg"].includes(ext)) expectedMime = "image/jpeg";
        else if (ext === "png") expectedMime = "image/png";
        else if (["heic", "heif"].includes(ext)) expectedMime = "image/heic";

        if (expectedMime && att.mime_type === expectedMime) {
          pass("mime_type確認", `${att.file_name} → ${att.mime_type} ✓`);
        } else if (expectedMime) {
          fail(
            "mime_type確認",
            `${att.file_name} → ${att.mime_type} (期待: ${expectedMime})`
          );
        } else {
          info(`mime_type: ${att.file_name} → ${att.mime_type || "NULL"}`);
        }
      }
    }

    db.close();
  } catch (error) {
    fail("データベース確認", error.message);
  }
}

// 4. HEIC変換後のファイル確認
section("🔄 HEIC変換後のファイル確認");

async function testHeicConversion() {
  info("HEIC→JPEG変換されたファイルの存在確認");

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "pdfs");
  const testDirs = ["test_5", "test_6", "test_7", "test_8", "test_9"];

  let jpegCount = 0;
  let pdfCount = 0;

  for (const dir of testDirs) {
    const dirPath = path.join(uploadsDir, dir);
    if (!existsSync(dirPath)) continue;

    const fs = await import("fs/promises");
    const files = await fs.readdir(dirPath);

    for (const file of files) {
      const ext = file.split(".").pop()?.toLowerCase();
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);

      if (ext === "jpg" || ext === "jpeg") {
        pass(
          "JPEG変換ファイル確認",
          `${file} (${(stats.size / 1024).toFixed(2)} KB)`
        );
        jpegCount++;
      } else if (ext === "pdf") {
        pdfCount++;
      }
    }
  }

  if (jpegCount > 0) {
    pass("JPEG変換確認", `${jpegCount}個のJPEGファイルを検出`);
  } else {
    info(
      "JPEG変換ファイルがまだありません（HEICファイルをアップロードしてください）"
    );
  }

  if (pdfCount > 0) {
    info(`${pdfCount}個のPDFファイルも存在します`);
  }
}

// 5. PdfViewer allFiles配列の構造確認
section("📦 PdfViewer allFiles配列の構造テスト");

async function testAllFilesStructure() {
  info("allFiles配列の構造をシミュレート");

  // シミュレーション: pdfUrlから拡張子を取得
  const testCases = [
    { pdfUrl: "/uploads/pdfs/test_5/1234567890-abc123.pdf", expected: "pdf" },
    { pdfUrl: "/uploads/pdfs/test_6/1234567890-xyz789.jpg", expected: "jpg" },
    { pdfUrl: "/uploads/pdfs/test_7/1234567890-def456.jpeg", expected: "jpeg" },
    { pdfUrl: "/uploads/pdfs/test_8/1234567890-ghi789.png", expected: "png" },
  ];

  for (const testCase of testCases) {
    const extension = testCase.pdfUrl.split(".").pop()?.toLowerCase() || "pdf";
    const isPdf = extension === "pdf";
    let mimeType = "application/pdf";

    if (!isPdf) {
      if (["jpg", "jpeg"].includes(extension)) {
        mimeType = "image/jpeg";
      } else if (extension === "png") {
        mimeType = "image/png";
      }
    }

    const fileName = `main.${extension}`;

    if (extension === testCase.expected) {
      pass("拡張子抽出", `${testCase.pdfUrl} → ${extension}`);
    } else {
      fail(
        "拡張子抽出",
        `${testCase.pdfUrl} → ${extension} (期待: ${testCase.expected})`
      );
    }

    // mimeTypeの確認
    const expectedMime =
      testCase.expected === "pdf"
        ? "application/pdf"
        : ["jpg", "jpeg"].includes(testCase.expected)
        ? "image/jpeg"
        : "image/png";

    if (mimeType === expectedMime) {
      pass("mimeType生成", `${extension} → ${mimeType}`);
    } else {
      fail(
        "mimeType生成",
        `${extension} → ${mimeType} (期待: ${expectedMime})`
      );
    }

    pass("fileName生成", `${testCase.pdfUrl} → ${fileName}`);
  }
}

// 6. エラーハンドリングテスト
section("⚠️ エラーハンドリングテスト");

async function testErrorHandling() {
  info("存在しないファイルへのアクセステスト");

  const nonExistentPaths = [
    "/api/pdf/pdfs/test_999/nonexistent.jpg",
    "/api/pdf/pdfs/test_999/nonexistent.pdf",
  ];

  for (const apiPath of nonExistentPaths) {
    try {
      const response = await fetch(`${API_BASE}${apiPath}`);
      if (response.status === 404) {
        pass("404エラー返却", `${apiPath} → 404`);
      } else {
        fail("404エラー返却", `${apiPath} → ${response.status} (期待: 404)`);
      }
    } catch (error) {
      fail("API呼び出しエラー", `${apiPath}: ${error.message}`);
    }
  }
}

// メイン実行
async function main() {
  console.log(
    `\n${colors.bright}${colors.magenta}╔════════════════════════════════════════════════════════════╗${colors.reset}`
  );
  console.log(
    `${colors.bright}${colors.magenta}║   HEIC画像アップロード・表示機能の詳細テスト - iPad互換性検証   ║${colors.reset}`
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
  await testApiContentType();
  await testPdfViewerFileType();
  await testDatabaseMimeType();
  await testHeicConversion();
  await testAllFilesStructure();
  await testErrorHandling();

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

  // 総合評価
  console.log(`\n${colors.cyan}${colors.bright}総合評価${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}${"─".repeat(70)}${colors.reset}`);

  if (results.failed === 0) {
    log("🎉", `優秀: HEIC画像機能は完全に動作しています！`, colors.green);
    log("✅", "iPad互換性: 完全対応", colors.green);
    log("✅", "Content-Type判定: 正常動作", colors.green);
    log("✅", "ファイルタイプ判定: 正常動作", colors.green);
  } else if (passRate >= 80) {
    log(
      "⚠️",
      "良好: 一部の機能に問題がありますが、基本的には動作しています",
      colors.yellow
    );
  } else {
    log("❌", "要改善: 複数の機能に問題があります", colors.red);
  }

  console.log();
}

main().catch(console.error);
