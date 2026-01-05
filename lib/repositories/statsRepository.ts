import db from "../db/db-instance";

export const statsRepository = {
  getSummary: () => {
    // 総テスト数
    const totalTests = db
      .prepare("SELECT COUNT(*) as count FROM tests")
      .get() as { count: number };

    // 学年別テスト数
    const testsByGrade = db
      .prepare(
        `
        SELECT grade, COUNT(*) as count
        FROM tests
        GROUP BY grade
        ORDER BY count DESC
      `
      )
      .all() as { grade: string; count: number }[];

    // 科目別テスト数
    const testsBySubject = db
      .prepare(
        `
        SELECT subject, COUNT(*) as count
        FROM tests
        GROUP BY subject
        ORDER BY count DESC
      `
      )
      .all() as { subject: string; count: number }[];

    // タグ使用頻度トップ10
    const topTags = db
      .prepare(
        `
        SELECT 
          tg.id,
          tg.name,
          tg.color,
          COUNT(tt.test_id) as usage_count
        FROM tags tg
        LEFT JOIN test_tags tt ON tg.id = tt.tag_id
        GROUP BY tg.id
        ORDER BY usage_count DESC
        LIMIT 10
      `
      )
      .all() as {
      id: number;
      name: string;
      color: string;
      usage_count: number;
    }[];

    // フォルダ別テスト数（トップ10）
    const testsByFolder = db
      .prepare(
        `
        SELECT 
          f.id,
          f.name,
          COUNT(tf.test_id) as count
        FROM folders f
        LEFT JOIN test_folders tf ON f.id = tf.folder_id
        WHERE f.name != '未分類' AND f.name != 'すべてのテスト'
        GROUP BY f.id
        ORDER BY count DESC
        LIMIT 10
      `
      )
      .all() as { id: number; name: string; count: number }[];

    // 総フォルダ数
    const totalFolders = db
      .prepare(
        "SELECT COUNT(*) as count FROM folders WHERE name != '未分類' AND name != 'すべてのテスト'"
      )
      .get() as { count: number };

    // 総タグ数
    const totalTags = db
      .prepare("SELECT COUNT(*) as count FROM tags")
      .get() as { count: number };

    // PDF添付ありのテスト数
    const testsWithPdf = db
      .prepare("SELECT COUNT(*) as count FROM tests WHERE pdf_path IS NOT NULL")
      .get() as { count: number };

    // 最近追加されたテスト（直近10件）
    const recentTests = db
      .prepare(
        `
        SELECT 
          t.id,
          t.name,
          t.subject,
          t.grade,
          t.created_at,
          f.name as folder_name
        FROM tests t
        LEFT JOIN folders f ON t.folder_id = f.id
        ORDER BY t.created_at DESC
        LIMIT 10
      `
      )
      .all() as {
      id: number;
      name: string;
      subject: string;
      grade: string;
      created_at: string;
      folder_name: string;
    }[];

    return {
      overview: {
        totalTests: totalTests.count,
        totalFolders: totalFolders.count,
        totalTags: totalTags.count,
        testsWithPdf: testsWithPdf.count,
        testsWithoutPdf: totalTests.count - testsWithPdf.count,
      },
      testsByGrade,
      testsBySubject,
      topTags,
      testsByFolder,
      recentTests,
    };
  }
};
