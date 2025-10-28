import { NextResponse } from 'next/server';
import { initializePostgres } from '@/lib/init-postgres';

/**
 * データベース初期化API
 * GET /api/init-db
 * Vercel環境でPostgreSQLを初期化
 */
export async function GET() {
  try {
    if (!process.env.POSTGRES_URL) {
      return NextResponse.json(
        { message: 'PostgreSQL not configured' },
        { status: 400 }
      );
    }

    await initializePostgres();

    return NextResponse.json({ 
      message: 'Database initialized successfully' 
    });
  } catch (error: any) {
    console.error('Database initialization error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize database', details: error.message },
      { status: 500 }
    );
  }
}
