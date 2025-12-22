import { sql } from "@vercel/postgres";
import fs from "fs";
import path from "path";

/**
 * PostgreSQLデータベースの初期化
 * Vercel環境でのみ実行
 */
export async function initializePostgres() {
  if (!process.env.POSTGRES_URL) {
    console.log("PostgreSQL not configured, skipping initialization");
    return;
  }

  try {
    console.log("Initializing PostgreSQL database...");

    // スキーマファイルを読み込み
    const schemaPath = path.join(process.cwd(), "lib", "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf-8");

    // SQL文を分割して実行
    const statements = schema
      .split(";")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0 && !s.startsWith("--"));

    for (const statement of statements) {
      try {
        await sql.query(statement);
      } catch (error: any) {
        // テーブルやインデックスが既に存在する場合はスキップ
        if (!error.message?.includes("already exists")) {
          console.error("Error executing statement:", statement);
          throw error;
        }
      }
    }

    console.log("PostgreSQL database initialized successfully");
  } catch (error) {
    console.error("Failed to initialize PostgreSQL:", error);
    throw error;
  }
}
