import db from "./db/db-instance";
import { runStartupTasks } from "./startupTasks";
import { addColumnIfNotExists } from "./db/db-helpers";
import {
  FOLDERS_TABLE_SCHEMA,
  TESTS_TABLE_SCHEMA,
  TEST_FOLDERS_TABLE_SCHEMA,
  TAGS_TABLE_SCHEMA,
  TEST_TAGS_TABLE_SCHEMA,
  TEST_ATTACHMENTS_TABLE_SCHEMA,
} from "./db/db-schema";

/**
 * データベース管理クラス
 * SQLiteを使用したテスト管理システムのデータベース操作
 */

/**
 * データベースの初期化
 * テーブルが存在しない場合は作成し、初期データを投入
 */
export function initializeDatabase() {
  // テーブル作成
  db.exec(FOLDERS_TABLE_SCHEMA);
  db.exec(TESTS_TABLE_SCHEMA);
  db.exec(TEST_FOLDERS_TABLE_SCHEMA);
  db.exec(TAGS_TABLE_SCHEMA);
  db.exec(TEST_TAGS_TABLE_SCHEMA);
  db.exec(TEST_ATTACHMENTS_TABLE_SCHEMA);

  // 学年・科目マスターテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // メール取込関連テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      imap_host TEXT DEFAULT 'imap.gmail.com',
      imap_port INTEGER DEFAULT 993,
      imap_user TEXT DEFAULT '',
      imap_password TEXT DEFAULT '',
      enabled INTEGER DEFAULT 0,
      default_subject TEXT DEFAULT '未分類',
      default_grade TEXT DEFAULT '未設定',
      default_folder_id INTEGER,
      default_tag_name TEXT DEFAULT '自動登録',
      name_prefix TEXT DEFAULT '[自動登録]',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS email_import_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE,
      uid INTEGER,
      subject TEXT,
      from_address TEXT,
      file_name TEXT,
      test_id INTEGER,
      status TEXT DEFAULT 'success',
      error_message TEXT,
      imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE SET NULL
    )
  `);

  // メール受信トレイ（割り振り待機状態のPDF）
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_inbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      original_subject TEXT,
      from_address TEXT,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      message_id TEXT,
      status TEXT DEFAULT 'pending',
      error_message TEXT
    )
  `);

  // 監査ログテーブル (#103)
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER,
      target_name TEXT,
      ip_address TEXT,
      user_agent TEXT,
      device_hint TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // コメントテーブル (#119)
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      device_hint TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 関連テストテーブル (#118)
  db.exec(`
    CREATE TABLE IF NOT EXISTS related_tests (
      test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      related_test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (test_id, related_test_id)
    )
  `);

  // インデックス作成
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tests_folder_id ON tests(folder_id);
    CREATE INDEX IF NOT EXISTS idx_tests_subject ON tests(subject);
    CREATE INDEX IF NOT EXISTS idx_tests_grade ON tests(grade);
    CREATE INDEX IF NOT EXISTS idx_test_tags_test_id ON test_tags(test_id);
    CREATE INDEX IF NOT EXISTS idx_test_tags_tag_id ON test_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_test_folders_test_id ON test_folders(test_id);
    CREATE INDEX IF NOT EXISTS idx_test_folders_folder_id ON test_folders(folder_id);
    CREATE INDEX IF NOT EXISTS idx_test_attachments_test_id ON test_attachments(test_id);
    CREATE INDEX IF NOT EXISTS idx_grades_display_order ON grades(display_order);
    CREATE INDEX IF NOT EXISTS idx_subjects_display_order ON subjects(display_order);
    CREATE INDEX IF NOT EXISTS idx_email_import_log_message_id ON email_import_log(message_id);
    CREATE INDEX IF NOT EXISTS idx_email_import_log_imported_at ON email_import_log(imported_at);
    CREATE INDEX IF NOT EXISTS idx_email_inbox_status ON email_inbox(status);
    CREATE INDEX IF NOT EXISTS idx_email_inbox_received_at ON email_inbox(received_at);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_test_comments_test_id ON test_comments(test_id);
  `);

  // マイグレーション: カラム追加
  addColumnIfNotExists("tests", "pdf_path", "TEXT");
  addColumnIfNotExists("tests", "description", "TEXT");
  addColumnIfNotExists("tests", "total_questions", "INTEGER");
  addColumnIfNotExists("tests", "total_score", "INTEGER");
  
  addColumnIfNotExists("folders", "parent_id", "INTEGER REFERENCES folders(id) ON DELETE CASCADE");
  const addedOrderIndex = addColumnIfNotExists("folders", "order_index", "INTEGER DEFAULT 0");

  addColumnIfNotExists("test_attachments", "mime_type", "TEXT");
  addColumnIfNotExists("test_attachments", "file_size", "INTEGER");

  addColumnIfNotExists("test_tags", "created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP");
  addColumnIfNotExists("test_folders", "created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP");
  addColumnIfNotExists("tags", "created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP");
  addColumnIfNotExists("tags", "color", "TEXT DEFAULT '#3B82F6'");
  // #80 コンテンツハッシュ（重複検知）
  addColumnIfNotExists("email_inbox", "content_hash", "TEXT");

  // フォルダのorder_index初期化 (カラム追加時のみ)
  if (addedOrderIndex) {
    try {
      const folders = db.prepare("SELECT id FROM folders ORDER BY id").all() as { id: number }[];
      const updateStmt = db.prepare("UPDATE folders SET order_index = ? WHERE id = ?");
      const transaction = db.transaction((folders: { id: number }[]) => {
        folders.forEach((folder, index) => updateStmt.run(index, folder.id));
      });
      transaction(folders);
      console.log(`Updated order_index for ${folders.length} folders.`);
    } catch (e) {
      console.error("Error updating order_index:", e);
    }
  }

  // UNIQUE制約チェック
  try {
    const schemaInfo = db.prepare(`
      SELECT sql FROM sqlite_master 
      WHERE type='table' AND name='folders'
    `).get() as { sql: string } | undefined;
    
    if (schemaInfo && schemaInfo.sql.includes('name TEXT NOT NULL UNIQUE')) {
      console.log("⚠️  Detected old UNIQUE constraint on folders table.");
      console.log("   Please run: node scripts/migration/migrate-folder-unique-constraint.mjs");
    }
  } catch (error) {
    console.error("Error checking folder constraints:", error);
  }

  // 初期データ投入
  initializeData();
  
  // データ移行
  migrateData();
}

function initializeData() {
  // フォルダ
  const folderCount = db.prepare("SELECT COUNT(*) as count FROM folders").get() as { count: number };
  if (folderCount.count === 0) {
    const insertFolder = db.prepare("INSERT INTO folders (name) VALUES (?)");
    insertFolder.run("すべてのテスト");
    insertFolder.run("未分類");
  } else {
    // 未分類フォルダ確認
    const uncategorized = db.prepare("SELECT id FROM folders WHERE name = ?").get("未分類");
    if (!uncategorized) {
      db.prepare("INSERT INTO folders (name) VALUES (?)").run("未分類");
    }
  }

  // 学年
  const gradeCount = db.prepare("SELECT COUNT(*) as count FROM grades").get() as { count: number };
  if (gradeCount.count === 0) {
    const insertGrade = db.prepare("INSERT INTO grades (name, display_order) VALUES (?, ?)");
    const grades = [
      ["小1", 1], ["小2", 2], ["小3", 3], ["小4", 4], ["小5", 5], ["小6", 6],
      ["中1", 7], ["中2", 8], ["中3", 9],
      ["高1", 10], ["高2", 11], ["高3", 12]
    ];
    const transaction = db.transaction((grades) => {
      grades.forEach(([name, order]: [string, number]) => insertGrade.run(name, order));
    });
    transaction(grades);
  }

  // 科目
  const subjectCount = db.prepare("SELECT COUNT(*) as count FROM subjects").get() as { count: number };
  if (subjectCount.count === 0) {
    const insertSubject = db.prepare("INSERT INTO subjects (name, display_order) VALUES (?, ?)");
    const subjects = [
      ["国語", 1], ["数学", 2], ["算数", 3], ["英語", 4], ["理科", 5], ["社会", 6],
      ["物理", 7], ["化学", 8], ["生物", 9], ["地学", 10],
      ["日本史", 11], ["世界史", 12], ["地理", 13], ["公民", 14]
    ];
    const transaction = db.transaction((subjects) => {
      subjects.forEach(([name, order]: [string, number]) => insertSubject.run(name, order));
    });
    transaction(subjects);
  }
}

function migrateData() {
  // tests.folder_id -> test_folders
  try {
    const allTests = db.prepare("SELECT id, folder_id FROM tests").all() as { id: number; folder_id: number }[];
    const insertTestFolder = db.prepare("INSERT OR IGNORE INTO test_folders (test_id, folder_id) VALUES (?, ?)");
    let migratedCount = 0;
    
    const transaction = db.transaction((tests) => {
      tests.forEach((test: { id: number; folder_id: number }) => {
        if (test.folder_id) {
          const result = insertTestFolder.run(test.id, test.folder_id);
          if (result.changes > 0) migratedCount++;
        }
      });
    });
    
    transaction(allTests);

    if (migratedCount > 0) {
      console.log(`Migrated ${migratedCount} test-folder relationships.`);
    }
  } catch (error) {
    console.error("Error migrating test-folder relationships:", error);
  }
}

// 初期化実行
initializeDatabase();

// 起動時タスク実行（バックアップチェック、PDFキャッシュクリーンアップ）
runStartupTasks();

export default db;