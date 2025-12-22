/**
 * 既存システムからデータを移行するスクリプト
 *
 * 使い方:
 * node migrate-from-old-system.mjs (既存システムのパス)
 *
 * 例:
 * node migrate-from-old-system.mjs "D:\old_system"
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), "../..");

// コマンドライン引数から既存システムのパスを取得
const oldSystemPath = process.argv[2];

if (!oldSystemPath) {
  console.error("❌ エラー: 既存システムのパスを指定してください");
  console.log("\n使い方:");
  console.log("  node migrate-from-old-system.mjs (既存システムのパス)");
  console.log("\n例:");
  console.log('  node migrate-from-old-system.mjs "D:\\old_system"');
  process.exit(1);
}

// パスの存在確認
if (!fs.existsSync(oldSystemPath)) {
  console.error(`❌ エラー: 指定されたパスが見つかりません: ${oldSystemPath}`);
  process.exit(1);
}

const oldDbPath = path.join(oldSystemPath, "data", "tests.db");
const oldUploadsPath = path.join(oldSystemPath, "public", "uploads");

const newDbPath = path.join(__dirname, "data", "tests.db");
const newUploadsPath = path.join(__dirname, "public", "uploads");

console.log("=== システム移行スクリプト ===\n");

// ステップ1: 既存システムのファイル確認
console.log("【ステップ1】既存システムのファイル確認");

if (!fs.existsSync(oldDbPath)) {
  console.error(`❌ データベースファイルが見つかりません: ${oldDbPath}`);
  process.exit(1);
}
console.log(`✅ データベースファイル: ${oldDbPath}`);

const oldDbSize = fs.statSync(oldDbPath).size;
console.log(`   サイズ: ${(oldDbSize / 1024).toFixed(2)} KB`);

if (fs.existsSync(oldUploadsPath)) {
  const uploadFiles = fs.readdirSync(oldUploadsPath, { recursive: true });
  console.log(`✅ アップロードファイル: ${uploadFiles.length}件`);
} else {
  console.log(`⚠️  アップロードフォルダが見つかりません: ${oldUploadsPath}`);
}

// ステップ2: 現在のシステムをバックアップ
console.log("\n【ステップ2】現在のシステムをバックアップ");

const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
const backupDbPath = path.join(
  __dirname,
  "data",
  `tests_backup_${timestamp}.db`
);

if (fs.existsSync(newDbPath)) {
  fs.copyFileSync(newDbPath, backupDbPath);
  console.log(`✅ データベースをバックアップ: ${backupDbPath}`);
} else {
  console.log("⚠️  既存のデータベースが見つかりません（新規インストール）");
}

// ステップ3: データベースをコピー
console.log("\n【ステップ3】データベースをコピー");

// dataディレクトリが存在しない場合は作成
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`✅ dataディレクトリを作成: ${dataDir}`);
}

fs.copyFileSync(oldDbPath, newDbPath);
console.log(`✅ データベースをコピー: ${oldDbPath} -> ${newDbPath}`);

// ステップ4: アップロードファイルをコピー
console.log("\n【ステップ4】アップロードファイルをコピー");

if (fs.existsSync(oldUploadsPath)) {
  // public/uploadsディレクトリが存在しない場合は作成
  if (!fs.existsSync(newUploadsPath)) {
    fs.mkdirSync(newUploadsPath, { recursive: true });
    console.log(`✅ uploadsディレクトリを作成: ${newUploadsPath}`);
  }

  // ファイルを再帰的にコピー
  function copyRecursive(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    let count = 0;

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true });
        }
        count += copyRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
        count++;
      }
    }

    return count;
  }

  const copiedFiles = copyRecursive(oldUploadsPath, newUploadsPath);
  console.log(`✅ ${copiedFiles}件のファイルをコピー`);
} else {
  console.log("⚠️  アップロードフォルダが見つかりません（スキップ）");
}

// ステップ5: 移行完了
console.log("\n【ステップ5】移行完了");
console.log("✅ すべての移行作業が完了しました！");
console.log("\n次のステップ:");
console.log("  1. npm run dev でサーバーを起動");
console.log("  2. http://localhost:3000 でシステムを確認");
console.log("  3. データが正しく移行されているか確認");
console.log("\n問題が発生した場合:");
console.log(`  バックアップから復元: ${backupDbPath}`);
