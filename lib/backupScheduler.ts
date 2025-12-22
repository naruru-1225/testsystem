import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const MAX_BACKUPS = 7;

// Helper to copy directory recursively
async function copyDir(src: string, dest: string) {
  try {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  } catch (error) {
    console.error(`[Backup] Error copying directory ${src} to ${dest}:`, error);
    throw error;
  }
}

export async function performBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`);

  console.log(`[Backup] Starting backup to ${backupPath}...`);

  try {
    // Create backup directory
    await fs.mkdir(backupPath, { recursive: true });

    // Backup data folder
    if (existsSync(DATA_DIR)) {
        console.log(`[Backup] Backing up data folder...`);
        await copyDir(DATA_DIR, path.join(backupPath, 'data'));
    } else {
        console.warn(`[Backup] Data folder not found at ${DATA_DIR}`);
    }

    // Backup upload folder
    if (existsSync(UPLOAD_DIR)) {
        console.log(`[Backup] Backing up upload folder...`);
        await copyDir(UPLOAD_DIR, path.join(backupPath, 'public', 'upload'));
    } else {
        console.warn(`[Backup] Upload folder not found at ${UPLOAD_DIR}`);
    }

    console.log(`[Backup] Backup completed successfully.`);

    // Rotate backups
    await rotateBackups();

  } catch (error) {
    console.error(`[Backup] Backup failed:`, error);
  }
}

async function rotateBackups() {
  try {
    if (!existsSync(BACKUP_DIR)) return;
    
    const files = await fs.readdir(BACKUP_DIR);
    const backupFolders = files.filter(f => f.startsWith('backup-')).sort();

    if (backupFolders.length > MAX_BACKUPS) {
      const toDelete = backupFolders.slice(0, backupFolders.length - MAX_BACKUPS);
      for (const folder of toDelete) {
        const folderPath = path.join(BACKUP_DIR, folder);
        console.log(`[Backup] Removing old backup: ${folder}`);
        await fs.rm(folderPath, { recursive: true, force: true });
      }
    }
  } catch (error) {
    console.error(`[Backup] Error rotating backups:`, error);
  }
}

export function startBackupScheduler() {
  // Calculate time until next 19:30
  const now = new Date();
  let target = new Date(now);
  target.setHours(19, 30, 0, 0);

  if (target.getTime() <= now.getTime()) {
    // If it's already past 19:30, schedule for tomorrow
    target.setDate(target.getDate() + 1);
  }

  const delay = target.getTime() - now.getTime();
  console.log(`[Backup] Scheduler started. Next backup scheduled in ${Math.round(delay / 1000 / 60)} minutes at ${target.toLocaleString()}`);

  setTimeout(() => {
    performBackup();
    // Schedule next daily backup
    setInterval(performBackup, 24 * 60 * 60 * 1000);
  }, delay);
}
