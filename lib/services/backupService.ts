import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

export const backupService = {
  createDownloadableBackup: () => {
    const dbPath = path.join(process.cwd(), "data", "tests.db");
    if (!fs.existsSync(dbPath)) {
      throw new Error("データベースファイルが見つかりません");
    }

    const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
    const filename = `backup-${timestamp}.db`;
    const tempBackupPath = path.join(process.cwd(), "data", filename);

    const db = new Database(dbPath, { readonly: true });
    try {
      db.exec(`VACUUM INTO '${tempBackupPath.replace(/\\/g, "/")}'`);
    } finally {
      db.close();
    }

    const backupBuffer = fs.readFileSync(tempBackupPath);
    fs.unlinkSync(tempBackupPath);

    return {
      buffer: backupBuffer,
      filename,
    };
  },

  saveTempBackup: async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempDbPath = path.join(tempDir, `restore-temp-${Date.now()}.db`);
    fs.writeFileSync(tempDbPath, buffer);
    return tempDbPath;
  },

  getTestsFromBackup: (dbPath: string) => {
    const backupDb = new Database(dbPath, { readonly: true });
    try {
      const tests = backupDb.prepare(`
        SELECT 
          t.*,
          f.name as folder_name
        FROM tests t
        LEFT JOIN folders f ON t.folder_id = f.id
        ORDER BY t.created_at DESC
      `).all();

      // 各テストのタグ情報を取得
      return tests.map((test: any) => {
        const tags = backupDb
          .prepare(`
            SELECT tg.*
            FROM tags tg
            INNER JOIN test_tags tt ON tg.id = tt.tag_id
            WHERE tt.test_id = ?
          `)
          .all(test.id);

        const folders = backupDb
          .prepare(`
            SELECT f.*
            FROM folders f
            INNER JOIN test_folders tf ON f.id = tf.folder_id
            WHERE tf.test_id = ?
          `)
          .all(test.id);

        return {
          ...test,
          tags,
          folders,
        };
      });
    } finally {
      backupDb.close();
    }
  }
};
