-- PostgreSQL用のスキーマ定義

-- フォルダテーブル
CREATE TABLE IF NOT EXISTS folders (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, parent_id)
);

-- テストテーブル
CREATE TABLE IF NOT EXISTS tests (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  pdf_path TEXT,
  description TEXT,
  total_questions INTEGER,
  total_score INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- タグテーブル
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#3B82F6'
);

-- テストとタグの関連テーブル
CREATE TABLE IF NOT EXISTS test_tags (
  id SERIAL PRIMARY KEY,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(test_id, tag_id)
);

-- テストとフォルダの関連テーブル
CREATE TABLE IF NOT EXISTS test_folders (
  id SERIAL PRIMARY KEY,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  UNIQUE(test_id, folder_id)
);

-- テスト添付ファイルテーブル
CREATE TABLE IF NOT EXISTS test_attachments (
  id SERIAL PRIMARY KEY,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_tests_folder_id ON tests(folder_id);
CREATE INDEX IF NOT EXISTS idx_tests_subject ON tests(subject);
CREATE INDEX IF NOT EXISTS idx_tests_grade ON tests(grade);
CREATE INDEX IF NOT EXISTS idx_test_tags_test_id ON test_tags(test_id);
CREATE INDEX IF NOT EXISTS idx_test_tags_tag_id ON test_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_test_folders_test_id ON test_folders(test_id);
CREATE INDEX IF NOT EXISTS idx_test_folders_folder_id ON test_folders(folder_id);
CREATE INDEX IF NOT EXISTS idx_test_attachments_test_id ON test_attachments(test_id);

-- 初期データ
INSERT INTO folders (name) VALUES ('すべてのテスト') ON CONFLICT DO NOTHING;
INSERT INTO folders (name) VALUES ('未分類') ON CONFLICT DO NOTHING;
