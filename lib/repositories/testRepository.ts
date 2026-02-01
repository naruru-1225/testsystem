import db from "../db/db-instance";
import { getDescendantFolderIds } from "../db/db-helpers";
import type { Test, Tag, Folder, TestWithTags, TestAttachment } from "@/types/database";

export interface TestFilters {
  folderId?: number;
  grade?: string;
  subject?: string;
  tagId?: number;
  search?: string;
}

export interface CreateTestData {
  name: string;
  subject: string;
  grade: string;
  folderId: number;
  description?: string;
  pdfPath?: string;
  tagIds?: number[];
  folderIds?: number[]; // マルチフォルダ対応
  totalQuestions?: number;
  totalScore?: number;
  attachments?: { fileName: string; filePath: string; mimeType?: string; fileSize?: number }[];
}

export const testRepository = {
  getAll: (filters: TestFilters) => {
    let query = `
      SELECT 
        t.*,
        f.name as folder_name
      FROM tests t
      LEFT JOIN folders f ON t.folder_id = f.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // フォルダでフィルタ
    if (filters.folderId) {
      // 選択されたフォルダとその子孫フォルダのIDを取得
      const descendantIds = getDescendantFolderIds(filters.folderId);
      descendantIds.push(filters.folderId); // 自分自身も含める

      // test_foldersテーブルを使ってフィルタ
      if (descendantIds.length === 1) {
        query += ` AND EXISTS (
          SELECT 1 FROM test_folders tf 
          WHERE tf.test_id = t.id AND tf.folder_id = ?
        )`;
        params.push(filters.folderId);
      } else {
        const placeholders = descendantIds.map(() => "?").join(",");
        query += ` AND EXISTS (
          SELECT 1 FROM test_folders tf 
          WHERE tf.test_id = t.id AND tf.folder_id IN (${placeholders})
        )`;
        params.push(...descendantIds);
      }
    }

    // 学年でフィルタ
    if (filters.grade) {
      query += " AND t.grade = ?";
      params.push(filters.grade);
    }

    // 科目でフィルタ
    if (filters.subject) {
      query += " AND t.subject = ?";
      params.push(filters.subject);
    }

    // タグでフィルタ
    if (filters.tagId) {
      query += ` AND EXISTS (
        SELECT 1 FROM test_tags tt 
        WHERE tt.test_id = t.id AND tt.tag_id = ?
      )`;
      params.push(filters.tagId);
    }

    // 検索条件
    if (filters.search) {
      query +=
        " AND (t.name LIKE ? OR t.subject LIKE ? OR t.grade LIKE ? OR t.description LIKE ?)";
      const searchPattern = `%${filters.search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += " ORDER BY t.created_at DESC";

    const stmt = db.prepare(query);
    const tests = stmt.all(...params) as (Test & { folder_name: string })[];

    // 各テストに紐づくタグとフォルダを取得
    return tests.map((test) => {
      const tagStmt = db.prepare(`
        SELECT tg.*
        FROM tags tg
        INNER JOIN test_tags tt ON tg.id = tt.tag_id
        WHERE tt.test_id = ?
      `);
      const tags = tagStmt.all(test.id) as Tag[];

      const folderStmt = db.prepare(`
        SELECT f.*
        FROM folders f
        INNER JOIN test_folders tf ON f.id = tf.folder_id
        WHERE tf.test_id = ?
      `);
      const folders = folderStmt.all(test.id) as Folder[];

      return {
        ...test,
        tags,
        folders,
      } as TestWithTags;
    });
  },

  create: (data: CreateTestData) => {
    const transaction = db.transaction(() => {
      // 1. テスト作成
      const insertTest = db.prepare(`
        INSERT INTO tests (name, subject, grade, folder_id, description, pdf_path, total_questions, total_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = insertTest.run(
        data.name,
        data.subject,
        data.grade,
        data.folderId,
        data.description || null,
        data.pdfPath || null,
        data.totalQuestions || null,
        data.totalScore || null
      );
      const testId = result.lastInsertRowid as number;

      // 2. タグ紐付け
      if (data.tagIds && data.tagIds.length > 0) {
        const insertTag = db.prepare(
          "INSERT INTO test_tags (test_id, tag_id) VALUES (?, ?)"
        );
        for (const tagId of data.tagIds) {
          insertTag.run(testId, tagId);
        }
      }

      // 3. フォルダ紐付け (メインフォルダ + 追加フォルダ)
      const folderIdsToLink = new Set<number>();
      folderIdsToLink.add(data.folderId);
      if (data.folderIds) {
        data.folderIds.forEach((id) => folderIdsToLink.add(id));
      }

      const insertFolder = db.prepare(
        "INSERT INTO test_folders (test_id, folder_id) VALUES (?, ?)"
      );
      for (const folderId of folderIdsToLink) {
        insertFolder.run(testId, folderId);
      }

      // 4. 添付ファイル保存
      if (data.attachments && data.attachments.length > 0) {
        const insertAttachment = db.prepare(
          "INSERT INTO test_attachments (test_id, file_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)"
        );
        for (const attachment of data.attachments) {
          // mimeTypeがない場合は拡張子から推測
          let fileType = attachment.mimeType || 'application/octet-stream';
          if (!attachment.mimeType && attachment.fileName) {
            const ext = attachment.fileName.split('.').pop()?.toLowerCase();
            if (ext === 'pdf') fileType = 'application/pdf';
            else if (['jpg', 'jpeg'].includes(ext || '')) fileType = 'image/jpeg';
            else if (ext === 'png') fileType = 'image/png';
            else if (['heic', 'heif'].includes(ext || '')) fileType = 'image/heic';
            else if (ext === 'gif') fileType = 'image/gif';
            else if (ext === 'webp') fileType = 'image/webp';
          }
          insertAttachment.run(testId, attachment.fileName, attachment.filePath, fileType, attachment.fileSize || null);
        }
      }

      return testId;
    });

    const newTestId = transaction();
    
    // 作成されたテストを取得して返す
    return testRepository.getById(newTestId);
  },

  getById: (id: number) => {
    const test = db.prepare("SELECT * FROM tests WHERE id = ?").get(id) as Test | undefined;
    if (!test) return undefined;

    const tags = db.prepare(`
      SELECT tg.*
      FROM tags tg
      INNER JOIN test_tags tt ON tg.id = tt.tag_id
      WHERE tt.test_id = ?
    `).all(id) as Tag[];

    const folders = db.prepare(`
      SELECT f.*
      FROM folders f
      INNER JOIN test_folders tf ON f.id = tf.folder_id
      WHERE tf.test_id = ?
    `).all(id) as Folder[];

    return { ...test, tags, folders } as TestWithTags;
  },

  update: (id: number, data: Partial<CreateTestData>) => {
    const transaction = db.transaction(() => {
      // 1. テスト更新
      const updates: string[] = [];
      const params: any[] = [];

      if (data.name !== undefined) { updates.push("name = ?"); params.push(data.name); }
      if (data.subject !== undefined) { updates.push("subject = ?"); params.push(data.subject); }
      if (data.grade !== undefined) { updates.push("grade = ?"); params.push(data.grade); }
      if (data.folderId !== undefined) { updates.push("folder_id = ?"); params.push(data.folderId); }
      if (data.description !== undefined) { updates.push("description = ?"); params.push(data.description); }
      if (data.pdfPath !== undefined) { updates.push("pdf_path = ?"); params.push(data.pdfPath); }
      if (data.totalQuestions !== undefined) { updates.push("total_questions = ?"); params.push(data.totalQuestions); }
      if (data.totalScore !== undefined) { updates.push("total_score = ?"); params.push(data.totalScore); }

      if (updates.length > 0) {
        params.push(id);
        db.prepare(`UPDATE tests SET ${updates.join(", ")} WHERE id = ?`).run(...params);
      }

      // 2. タグ更新 (全削除して再挿入)
      if (data.tagIds !== undefined) {
        db.prepare("DELETE FROM test_tags WHERE test_id = ?").run(id);
        if (data.tagIds.length > 0) {
          const insertTag = db.prepare("INSERT INTO test_tags (test_id, tag_id) VALUES (?, ?)");
          for (const tagId of data.tagIds) {
            insertTag.run(id, tagId);
          }
        }
      }

      // 3. フォルダ更新 (全削除して再挿入)
      if (data.folderIds !== undefined) {
        db.prepare("DELETE FROM test_folders WHERE test_id = ?").run(id);
        const folderIdsToLink = new Set<number>();
        // メインフォルダも含める
        if (data.folderId !== undefined) {
          folderIdsToLink.add(data.folderId);
        } else {
          // 現在のメインフォルダを取得して追加する必要があるが、
          // ここではdata.folderIdsに全て含まれていることを期待するか、
          // 呼び出し元で制御する。
          // 簡易的に data.folderIds が渡されたらそれを使う。
        }
        
        data.folderIds.forEach(fid => folderIdsToLink.add(fid));

        const insertFolder = db.prepare("INSERT INTO test_folders (test_id, folder_id) VALUES (?, ?)");
        for (const folderId of folderIdsToLink) {
          insertFolder.run(id, folderId);
        }
      }
      
      // 4. 添付ファイル追加 (既存のものは削除しない、追加のみ)
      if (data.attachments && data.attachments.length > 0) {
        const insertAttachment = db.prepare(
          "INSERT INTO test_attachments (test_id, file_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)"
        );
        for (const attachment of data.attachments) {
          // mimeTypeがない場合は拡張子から推測
          let fileType = attachment.mimeType || 'application/octet-stream';
          if (!attachment.mimeType && attachment.fileName) {
            const ext = attachment.fileName.split('.').pop()?.toLowerCase();
            if (ext === 'pdf') fileType = 'application/pdf';
            else if (['jpg', 'jpeg'].includes(ext || '')) fileType = 'image/jpeg';
            else if (ext === 'png') fileType = 'image/png';
            else if (['heic', 'heif'].includes(ext || '')) fileType = 'image/heic';
            else if (ext === 'gif') fileType = 'image/gif';
            else if (ext === 'webp') fileType = 'image/webp';
          }
          insertAttachment.run(id, attachment.fileName, attachment.filePath, fileType, attachment.fileSize || null);
        }
      }
    });

    transaction();
    return testRepository.getById(id);
  },

  delete: (id: number) => {
    db.prepare("DELETE FROM tests WHERE id = ?").run(id);
  },
  
  getAttachments: (testId: number) => {
    return db
      .prepare("SELECT id, test_id, file_name, file_path, mime_type, file_size, created_at as uploaded_at FROM test_attachments WHERE test_id = ? ORDER BY created_at DESC")
      .all(testId) as TestAttachment[];
  },

  getAttachment: (attachmentId: number) => {
    return db
      .prepare("SELECT * FROM test_attachments WHERE id = ?")
      .get(attachmentId) as { id: number; test_id: number; file_name: string; file_path: string } | undefined;
  },

  deleteAttachment: (attachmentId: number) => {
    db.prepare("DELETE FROM test_attachments WHERE id = ?").run(attachmentId);
  },

  getCategories: () => {
    // テストに存在する学年のみを取得
    const grades = db
      .prepare(
        `
        SELECT DISTINCT grade 
        FROM tests 
        WHERE grade IS NOT NULL 
        ORDER BY grade
      `
      )
      .all() as { grade: string }[];

    // 各学年ごとにテストが存在する科目を取得
    return grades.map((gradeRow) => {
      const subjects = db
        .prepare(
          `
          SELECT DISTINCT subject 
          FROM tests 
          WHERE grade = ? AND subject IS NOT NULL 
          ORDER BY subject
        `
        )
        .all(gradeRow.grade) as { subject: string }[];

      return {
        grade: gradeRow.grade,
        subjects: subjects.map((s) => s.subject),
      };
    });
  },

  restore: (test: any) => {
    const transaction = db.transaction(() => {
      // 1. テスト復元
      const insertTest = db.prepare(`
        INSERT INTO tests (id, name, subject, grade, folder_id, pdf_path, description, total_questions, total_score, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertTest.run(
        test.id,
        test.name,
        test.subject,
        test.grade,
        test.folder_id,
        test.pdf_path,
        test.description,
        test.total_questions,
        test.total_score,
        test.created_at,
        test.updated_at
      );

      // 2. フォルダ関連付け復元
      if (test.folders && test.folders.length > 0) {
        const insertTestFolder = db.prepare(
          "INSERT OR IGNORE INTO test_folders (test_id, folder_id) VALUES (?, ?)"
        );
        const checkFolder = db.prepare("SELECT id FROM folders WHERE id = ?");
        
        for (const folder of test.folders) {
          if (checkFolder.get(folder.id)) {
            insertTestFolder.run(test.id, folder.id);
          }
        }
      }

      // 3. タグ関連付け復元
      if (test.tags && test.tags.length > 0) {
        const insertTestTag = db.prepare(
          "INSERT OR IGNORE INTO test_tags (test_id, tag_id) VALUES (?, ?)"
        );
        const checkTag = db.prepare("SELECT id FROM tags WHERE id = ?");
        const createTag = db.prepare("INSERT INTO tags (id, name, color) VALUES (?, ?, ?)");

        for (const tag of test.tags) {
          if (checkTag.get(tag.id)) {
            insertTestTag.run(test.id, tag.id);
          } else {
            createTag.run(tag.id, tag.name, tag.color);
            insertTestTag.run(test.id, tag.id);
          }
        }
      }
    });

    transaction();
    return { message: "テストを復元しました", testId: test.id };
  },

  getAttachmentCount: (testId: number): number => {
    const result = db
      .prepare("SELECT COUNT(*) as count FROM test_attachments WHERE test_id = ?")
      .get(testId) as { count: number };
    return result.count;
  },

  addAttachment: (
    testId: number,
    fileName: string,
    filePath: string,
    mimeType: string,
    fileSize: number
  ) => {
    const insert = db.prepare(
      "INSERT INTO test_attachments (test_id, file_name, file_path, mime_type, file_size) VALUES (?, ?, ?, ?, ?)"
    );
    const result = insert.run(testId, fileName, filePath, mimeType, fileSize);
    return result.lastInsertRowid as number;
  },
};
