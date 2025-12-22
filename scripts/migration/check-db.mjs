import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dbPath = path.join(__dirname, "data", "tests.db");

console.log("Database path:", dbPath);

try {
  const db = new Database(dbPath);

  // フォルダ一覧
  console.log("\n=== Folders ===");
  const folders = db.prepare("SELECT * FROM folders").all();
  console.log(folders);

  // テスト一覧
  console.log("\n=== Tests ===");
  const tests = db.prepare("SELECT * FROM tests").all();
  console.log(tests);

  // テーブル一覧
  console.log("\n=== Tables ===");
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all();
  console.log(tables);

  db.close();
  console.log("\nDatabase check completed successfully!");
} catch (error) {
  console.error("Error:", error);
}
