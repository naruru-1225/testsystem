import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

/**
 * データベース管理クラス
 * SQLiteを使用したテスト管理システムのデータベース操作
 */

// データベースファイルのパス
const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "tests.db");

// データディレクトリが存在しない場合は作成
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// データベースインスタンス
const db = new Database(DB_PATH);

/**
 * データベースの初期化
 * テーブルが存在しない場合は作成し、初期データを投入
 */
export function initializeDatabase() {
  // フォルダテーブルの作成
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      parent_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES folders (id) ON DELETE CASCADE
    )
  `);

  // テストテーブルの作成
  db.exec(`
    CREATE TABLE IF NOT EXISTS tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      grade TEXT NOT NULL,
      folder_id INTEGER NOT NULL,
      pdf_path TEXT,
      description TEXT,
      total_questions INTEGER,
      total_score INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE
    )
  `);

  // 既存のtestsテーブルに新しいカラムを追加(存在しない場合)
  try {
    const tableInfo = db.prepare("PRAGMA table_info(tests)").all() as any[];
    
    const hasPdfPath = tableInfo.some((col: any) => col.name === 'pdf_path');
    if (!hasPdfPath) {
      console.log('Adding pdf_path column to tests table...');
      db.exec('ALTER TABLE tests ADD COLUMN pdf_path TEXT');
      console.log('pdf_path column added successfully.');
    }

    const hasDescription = tableInfo.some((col: any) => col.name === 'description');
    if (!hasDescription) {
      console.log('Adding description column to tests table...');
      db.exec('ALTER TABLE tests ADD COLUMN description TEXT');
      console.log('description column added successfully.');
    }

    const hasTotalQuestions = tableInfo.some((col: any) => col.name === 'total_questions');
    if (!hasTotalQuestions) {
      console.log('Adding total_questions column to tests table...');
      db.exec('ALTER TABLE tests ADD COLUMN total_questions INTEGER');
      console.log('total_questions column added successfully.');
    }

    const hasTotalScore = tableInfo.some((col: any) => col.name === 'total_score');
    if (!hasTotalScore) {
      console.log('Adding total_score column to tests table...');
      db.exec('ALTER TABLE tests ADD COLUMN total_score INTEGER');
      console.log('total_score column added successfully.');
    }
  } catch (error) {
    console.error('Error adding pdf_path column:', error);
  }

  // 既存のfoldersテーブルに親フォルダカラムを追加(存在しない場合)
  try {
    const folderTableInfo = db.prepare("PRAGMA table_info(folders)").all() as any[];
    
    const hasParentId = folderTableInfo.some((col: any) => col.name === 'parent_id');
    if (!hasParentId) {
      console.log('Adding parent_id column to folders table...');
      db.exec('ALTER TABLE folders ADD COLUMN parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE');
      console.log('parent_id column added successfully.');
    }
  } catch (error) {
    console.error('Error adding parent_id column:', error);
  }

  // タグテーブルの作成
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#3B82F6'
    )
  `);

  // テストとタグの関連テーブルの作成
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
      UNIQUE(test_id, tag_id)
    )
  `);

  // テストとフォルダの関連テーブルの作成(多対多)
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL,
      folder_id INTEGER NOT NULL,
      FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE,
      UNIQUE(test_id, folder_id)
    )
  `);

  // インデックスの作成(検索高速化)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tests_folder_id ON tests(folder_id);
    CREATE INDEX IF NOT EXISTS idx_tests_subject ON tests(subject);
    CREATE INDEX IF NOT EXISTS idx_tests_grade ON tests(grade);
    CREATE INDEX IF NOT EXISTS idx_test_tags_test_id ON test_tags(test_id);
    CREATE INDEX IF NOT EXISTS idx_test_tags_tag_id ON test_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_test_folders_test_id ON test_folders(test_id);
    CREATE INDEX IF NOT EXISTS idx_test_folders_folder_id ON test_folders(folder_id);
  `);

  // 初期データの投入(フォルダが存在しない場合)
  const folderCount = db
    .prepare("SELECT COUNT(*) as count FROM folders")
    .get() as { count: number };

  if (folderCount.count === 0) {
    const insertFolder = db.prepare("INSERT INTO folders (name) VALUES (?)");
    insertFolder.run("すべてのテスト");
    insertFolder.run("未分類");
  }

  // 「未分類」フォルダが存在しない場合は追加
  const uncategorizedFolder = db
    .prepare("SELECT id FROM folders WHERE name = ?")
    .get("未分類");
  
  if (!uncategorizedFolder) {
    console.log('Adding "未分類" folder...');
    db.prepare("INSERT INTO folders (name) VALUES (?)").run("未分類");
    console.log('"未分類" folder added.');
  }

  // 既存データのマイグレーション: tests.folder_id から test_folders への移行
  try {
    console.log('Checking test-folder relationships migration...');
    
    // 全テストを取得
    const allTests = db.prepare("SELECT id, folder_id FROM tests").all() as { id: number; folder_id: number }[];
    
    const insertTestFolder = db.prepare("INSERT OR IGNORE INTO test_folders (test_id, folder_id) VALUES (?, ?)");
    
    let migratedCount = 0;
    allTests.forEach(test => {
      if (test.folder_id) {
        const result = insertTestFolder.run(test.id, test.folder_id);
        if (result.changes > 0) {
          migratedCount++;
        }
      }
    });
    
    if (migratedCount > 0) {
      console.log(`Migrated ${migratedCount} test-folder relationships.`);
    } else {
      console.log('All test-folder relationships are already up to date.');
    }
  } catch (error) {
    console.error('Error migrating test-folder relationships:', error);
  }

  // 初期データの投入(タグが存在しない場合) - サンプルデータは削除
  // ユーザーが管理者メニューから自由に作成できます

  // サンプルテストデータの投入 - 削除
  // ユーザーが自由にテストを作成できます
}

// データベース初期化の実行
initializeDatabase();

export default db;
