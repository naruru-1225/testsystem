import { sql } from '@vercel/postgres';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * データベースアダプター
 * 環境に応じてPostgreSQLまたはSQLiteを使用
 */

const isVercel = process.env.VERCEL === '1' || process.env.POSTGRES_URL;

// SQLite用の設定(ローカル環境)
let sqliteDb: Database.Database | null = null;

if (!isVercel) {
  const DB_DIR = path.join(process.cwd(), 'data');
  const DB_PATH = path.join(DB_DIR, 'tests.db');
  
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  
  sqliteDb = new Database(DB_PATH);
  sqliteDb.pragma('journal_mode = WAL');
}

/**
 * クエリ実行用のアダプター
 */
export const db = {
  /**
   * SELECT文を実行して全行を取得
   */
  async all<T = any>(query: string, params: any[] = []): Promise<T[]> {
    if (isVercel) {
      const result = await sql.query(query, params);
      return result.rows as T[];
    } else {
      return sqliteDb!.prepare(query).all(...params) as T[];
    }
  },

  /**
   * SELECT文を実行して1行を取得
   */
  async get<T = any>(query: string, params: any[] = []): Promise<T | undefined> {
    if (isVercel) {
      const result = await sql.query(query, params);
      return result.rows[0] as T | undefined;
    } else {
      return sqliteDb!.prepare(query).get(...params) as T | undefined;
    }
  },

  /**
   * INSERT/UPDATE/DELETE文を実行
   */
  async run(query: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    if (isVercel) {
      const result = await sql.query(query, params);
      return { 
        changes: result.rowCount || 0,
        lastInsertRowid: undefined 
      };
    } else {
      const info = sqliteDb!.prepare(query).run(...params);
      return { 
        changes: info.changes,
        lastInsertRowid: Number(info.lastInsertRowid)
      };
    }
  },

  /**
   * 複数のSQL文を実行(トランザクション)
   */
  async exec(sql: string): Promise<void> {
    if (isVercel) {
      // PostgreSQLの場合は個別に実行
      const statements = sql.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          await this.run(statement);
        }
      }
    } else {
      sqliteDb!.exec(sql);
    }
  },

  /**
   * プリペアドステートメントを作成
   */
  prepare(query: string) {
    if (isVercel) {
      // PostgreSQL用のプリペアドステートメント風インターフェース
      return {
        all: async (...params: any[]) => {
          const result = await sql.query(query, params);
          return result.rows;
        },
        get: async (...params: any[]) => {
          const result = await sql.query(query, params);
          return result.rows[0];
        },
        run: async (...params: any[]) => {
          const result = await sql.query(query, params);
          return { 
            changes: result.rowCount || 0,
            lastInsertRowid: undefined
          };
        }
      };
    } else {
      return sqliteDb!.prepare(query);
    }
  }
};

export default db;
