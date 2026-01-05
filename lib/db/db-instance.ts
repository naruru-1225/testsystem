import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// データベースファイルのパス
// Vercel環境では /tmp を使用、ローカル環境では data ディレクトリを使用
const isVercel = process.env.VERCEL === "1";
const DB_DIR = isVercel ? "/tmp" : path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "tests.db");

// データディレクトリが存在しない場合は作成(ローカル環境のみ)
if (!isVercel && !fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// データベースインスタンス
const db = new Database(DB_PATH);

// WALモードを有効化(パフォーマンス向上)
db.pragma("journal_mode = WAL");

export default db;
