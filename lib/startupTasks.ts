import fs from 'fs';
import path from 'path';
import { performBackup } from './backupScheduler';

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const PDF_CACHE_DIR = path.join(process.cwd(), 'public', 'pdf-cache');
const BACKUP_INTERVAL_HOURS = 24;
const CACHE_MAX_AGE_DAYS = 30;

/**
 * サーバー起動時に実行されるタスク
 * - バックアップの確認と実行
 * - PDFキャッシュのクリーンアップ
 */
export async function runStartupTasks() {
  console.log('========================================');
  console.log('[Startup] Running startup tasks...');
  console.log(`[Startup] Server started at ${new Date().toLocaleString('ja-JP')}`);
  
  try {
    // 1. バックアップチェック
    await checkAndPerformBackup();
    
    // 2. PDFキャッシュクリーンアップ
    await cleanupPdfCache();
    
    console.log('[Startup] All startup tasks completed.');
  } catch (error) {
    console.error('[Startup] Error during startup tasks:', error);
  }
  
  console.log('========================================');
}

/**
 * 最後のバックアップから24時間以上経過していればバックアップを実行
 */
async function checkAndPerformBackup() {
  try {
    // データベースファイルが存在しない場合はスキップ（初回起動時）
    const dbPath = path.join(process.cwd(), 'data', 'tests.db');
    if (!fs.existsSync(dbPath)) {
      console.log('[Startup] Database not found. Skipping backup (first startup).');
      return;
    }
    
    const lastBackupTime = getLastBackupTime();
    
    if (lastBackupTime === 0) {
      console.log('[Startup] No previous backup found. Creating first backup...');
      await performBackup();
      return;
    }
    
    const hoursSinceBackup = (Date.now() - lastBackupTime) / (1000 * 60 * 60);
    console.log(`[Startup] Last backup: ${new Date(lastBackupTime).toLocaleString('ja-JP')} (${hoursSinceBackup.toFixed(1)} hours ago)`);
    
    if (hoursSinceBackup >= BACKUP_INTERVAL_HOURS) {
      console.log('[Startup] Backup needed (>24 hours). Performing backup...');
      await performBackup();
    } else {
      console.log('[Startup] Backup: Skipped (within 24 hours)');
    }
  } catch (error) {
    console.error('[Startup] Error checking backup:', error);
  }
}

/**
 * 最後のバックアップ時刻を取得
 * @returns バックアップフォルダの最終更新日時（ミリ秒）、なければ0
 */
function getLastBackupTime(): number {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return 0;
    }
    
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-'))
      .sort()
      .reverse();
    
    if (backups.length === 0) {
      return 0;
    }
    
    const latestBackup = path.join(BACKUP_DIR, backups[0]);
    const stat = fs.statSync(latestBackup);
    return stat.mtimeMs;
  } catch (error) {
    console.error('[Startup] Error getting last backup time:', error);
    return 0;
  }
}

/**
 * 30日以上古いPDFキャッシュを削除
 */
async function cleanupPdfCache() {
  try {
    if (!fs.existsSync(PDF_CACHE_DIR)) {
      console.log('[Startup] PDF cache directory not found, skipping cleanup.');
      return;
    }
    
    const maxAgeMs = CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let deletedCount = 0;
    let totalSize = 0;
    
    console.log(`[Startup] Cleaning up PDF cache (max age: ${CACHE_MAX_AGE_DAYS} days)...`);
    
    // 各テストのキャッシュフォルダを走査
    const testDirs = fs.readdirSync(PDF_CACHE_DIR);
    
    for (const testDir of testDirs) {
      const testPath = path.join(PDF_CACHE_DIR, testDir);
      const testStat = fs.statSync(testPath);
      
      if (!testStat.isDirectory()) continue;
      
      // フォルダ内のPDFファイルを確認
      const files = fs.readdirSync(testPath);
      
      for (const file of files) {
        const filePath = path.join(testPath, file);
        const fileStat = fs.statSync(filePath);
        
        if (!fileStat.isFile()) continue;
        
        // 30日以上古いファイルを削除
        if (now - fileStat.mtimeMs > maxAgeMs) {
          const fileSizeMB = (fileStat.size / 1024 / 1024).toFixed(2);
          fs.unlinkSync(filePath);
          deletedCount++;
          totalSize += fileStat.size;
          console.log(`[Startup] Deleted cache: ${testDir}/${file} (${fileSizeMB} MB)`);
        }
      }
      
      // フォルダが空になったら削除
      const remainingFiles = fs.readdirSync(testPath);
      if (remainingFiles.length === 0) {
        fs.rmdirSync(testPath);
        console.log(`[Startup] Removed empty directory: ${testDir}`);
      }
    }
    
    if (deletedCount > 0) {
      const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
      console.log(`[Startup] PDF cache cleanup: Removed ${deletedCount} file(s), freed ${totalSizeMB} MB`);
    } else {
      console.log('[Startup] PDF cache cleanup: No files to remove');
    }
  } catch (error) {
    console.error('[Startup] Error cleaning up PDF cache:', error);
  }
}
