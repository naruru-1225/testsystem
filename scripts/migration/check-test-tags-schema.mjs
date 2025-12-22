import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "tests.db");
const db = new Database(dbPath);

console.log("=== test_tags テーブル ===");
const testTagsSchema = db
  .prepare(
    `
  SELECT sql FROM sqlite_master WHERE name='test_tags'
`
  )
  .get();
console.log(testTagsSchema?.sql || "テーブルが存在しません");

db.close();
