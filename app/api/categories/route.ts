import { NextResponse } from 'next/server';
import db from '@/lib/database';

/**
 * 学年・科目カテゴリ取得API
 * GET /api/categories
 */
export async function GET() {
  try {
    // 学年一覧を取得（テストに存在する学年のみ）
    const grades = db
      .prepare(`
        SELECT DISTINCT grade 
        FROM tests 
        WHERE grade IS NOT NULL 
        ORDER BY grade
      `)
      .all() as { grade: string }[];

    // 各学年の科目一覧を取得
    const categories = grades.map((gradeRow) => {
      const subjects = db
        .prepare(`
          SELECT DISTINCT subject 
          FROM tests 
          WHERE grade = ? AND subject IS NOT NULL 
          ORDER BY subject
        `)
        .all(gradeRow.grade) as { subject: string }[];

      return {
        grade: gradeRow.grade,
        subjects: subjects.map(s => s.subject),
      };
    });

    return NextResponse.json(categories);
  } catch (error: any) {
    console.error('Categories fetch error:', error);
    return NextResponse.json(
      { error: 'カテゴリの取得に失敗しました: ' + error.message },
      { status: 500 }
    );
  }
}
