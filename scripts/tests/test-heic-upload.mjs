/**
 * HEICファイルアップロードテスト
 *
 * このスクリプトはHEICファイルのアップロード機能をテストします
 */

import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:3000";

console.log("╔════════════════════════════════════════╗");
console.log("║  HEICファイルアップロードテスト       ║");
console.log("╚════════════════════════════════════════╝\n");

// サーバー接続確認
async function checkServer() {
  try {
    const response = await fetch(BASE_URL);
    if (response.ok) {
      console.log("✓ サーバーに接続成功\n");
      return true;
    }
  } catch (error) {
    console.error("✗ サーバーに接続できません");
    console.error("  npm run dev でサーバーを起動してください\n");
    return false;
  }
}

// 模擬HEICファイルのアップロードテスト
async function testHEICUpload() {
  console.log("📎 HEICファイルアップロードテスト");
  console.log("─────────────────────────────────────\n");

  try {
    // 様々なMIMEタイプでテスト
    const testCases = [
      {
        name: "test.heic",
        mimeType: "image/heic",
        description: "MIMEタイプ: image/heic",
      },
      {
        name: "test.heic",
        mimeType: "application/octet-stream",
        description: "MIMEタイプ: application/octet-stream (一般的なケース)",
      },
      {
        name: "test.HEIC",
        mimeType: "application/octet-stream",
        description: "大文字拡張子: .HEIC",
      },
      {
        name: "test.heif",
        mimeType: "image/heif",
        description: "HEIF形式",
      },
    ];

    for (const testCase of testCases) {
      console.log(`  テスト: ${testCase.description}`);

      // 小さいダミーデータ（実際のHEICファイルではないが、形式チェックのテスト用）
      const dummyData = Buffer.from("dummy heic file content for testing");

      const formData = new FormData();
      const blob = new Blob([dummyData], { type: testCase.mimeType });
      formData.append("file", blob, testCase.name);

      try {
        const response = await fetch(`${BASE_URL}/api/upload`, {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (response.ok) {
          console.log(`  ✓ アップロード受付成功`);
          console.log(`    ファイル名: ${testCase.name}`);
          console.log(`    MIMEタイプ: ${testCase.mimeType}\n`);
        } else {
          console.log(`  ✗ アップロード拒否: ${result.error}`);
          console.log(`    ファイル名: ${testCase.name}`);
          console.log(`    MIMEタイプ: ${testCase.mimeType}\n`);
        }
      } catch (error) {
        console.log(`  ✗ リクエストエラー: ${error.message}\n`);
      }
    }

    // 拒否されるべきファイルのテスト
    console.log("  テスト: 拒否されるべきファイル");

    const invalidFile = Buffer.from("invalid file");
    const formData = new FormData();
    const blob = new Blob([invalidFile], { type: "application/x-msdownload" });
    formData.append("file", blob, "test.exe");

    const response = await fetch(`${BASE_URL}/api/upload`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      console.log(`  ✓ 不正ファイルを正しく拒否: ${result.error}\n`);
    } else {
      console.log(`  ✗ 不正ファイルがアップロードされました\n`);
    }
  } catch (error) {
    console.error("✗ テストエラー:", error.message);
  }
}

// APIレスポンステスト
async function testAPIResponse() {
  console.log("\n📊 APIレスポンステスト");
  console.log("─────────────────────────────────────\n");

  try {
    // ファイルなしでリクエスト
    console.log("  テスト: ファイルなしリクエスト");
    const formData = new FormData();
    const response = await fetch(`${BASE_URL}/api/upload`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (response.status === 400 && result.error) {
      console.log(`  ✓ 適切なエラーレスポンス: ${result.error}\n`);
    } else {
      console.log(`  ✗ 予期しないレスポンス\n`);
    }
  } catch (error) {
    console.error("  ✗ テストエラー:", error.message, "\n");
  }
}

// メイン実行
async function main() {
  const serverOk = await checkServer();
  if (!serverOk) {
    process.exit(1);
  }

  await testHEICUpload();
  await testAPIResponse();

  console.log("════════════════════════════════════════");
  console.log("テスト完了");
  console.log("════════════════════════════════════════\n");
  console.log("💡 ヒント:");
  console.log("  - ブラウザでファイルをアップロードする際、");
  console.log("    開発者ツールのコンソールでログを確認してください");
  console.log("  - サーバーログでファイル情報が出力されます\n");
}

main();
