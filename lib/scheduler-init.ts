import { startBackupScheduler } from './backup-scheduler';

let isSchedulerInitialized = false;

/**
 * バックアップスケジューラーを初期化
 * サーバー起動時に一度だけ実行されます
 */
export function initializeBackupScheduler() {
  if (!isSchedulerInitialized) {
    startBackupScheduler();
    isSchedulerInitialized = true;
    console.log('バックアップスケジューラーが初期化されました');
  }
}
