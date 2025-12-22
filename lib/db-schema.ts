export const FOLDERS_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER,
    order_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES folders (id) ON DELETE CASCADE,
    UNIQUE(name, parent_id)
  )
`;

export const TESTS_TABLE_SCHEMA = `
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
`;

export const TEST_FOLDERS_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS test_folders (
    test_id INTEGER NOT NULL,
    folder_id INTEGER NOT NULL,
    PRIMARY KEY (test_id, folder_id),
    FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE
  )
`;

export const TAGS_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  )
`;

export const TEST_TAGS_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS test_tags (
    test_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (test_id, tag_id),
    FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
  )
`;

export const TEST_ATTACHMENTS_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS test_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE CASCADE
  )
`;
