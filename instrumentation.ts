/**
 * Next.js Instrumentation
 * サーバー起動時に実行される処理
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeBackupScheduler } = await import('./lib/scheduler-init');
    initializeBackupScheduler();
  }
}
