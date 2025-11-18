import cron, { ScheduledTask } from 'node-cron';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

/**
 * 自動バックアップスケジューラー
 * 毎日19:30にdataフォルダとpublic/uploadsフォルダをバックアップします
 * 最新7世代のバックアップを保持し、それ以前のものは自動削除します
 */

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const MAX_BACKUPS = 7;

/**
 * バックアップディレクトリが存在しない場合は作成
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * バックアップファイルを作成
 * @returns バックアップファイルのパス
 */
export async function createBackup(): Promise<string> {
  ensureBackupDir();

  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const backupFileName = `backup-${timestamp}.zip`;
  const backupFilePath = path.join(BACKUP_DIR, backupFileName);

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(backupFilePath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // 最大圧縮レベル
    });

    output.on('close', () => {
      console.log(`バックアップ作成完了: ${backupFileName} (${archive.pointer()} bytes)`);
      resolve(backupFilePath);
    });

    archive.on('error', (err) => {
      console.error('バックアップ作成エラー:', err);
      reject(err);
    });

    archive.pipe(output);

    // dataフォルダをバックアップ（存在する場合）
    if (fs.existsSync(DATA_DIR)) {
      archive.directory(DATA_DIR, 'data');
      console.log('dataフォルダをバックアップに追加しました');
    } else {
      console.log('dataフォルダが存在しないためスキップします');
    }

    // public/uploadsフォルダをバックアップ（存在する場合）
    if (fs.existsSync(UPLOADS_DIR)) {
      archive.directory(UPLOADS_DIR, 'uploads');
      console.log('uploadsフォルダをバックアップに追加しました');
    } else {
      console.log('uploadsフォルダが存在しないためスキップします');
    }

    archive.finalize();
  });
}

/**
 * 古いバックアップファイルを削除
 * 最新のMAX_BACKUPS個を残し、それ以前のものを削除
 */
export function cleanupOldBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return;
    }

    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('backup-') && file.endsWith('.zip'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // 新しい順にソート

    // MAX_BACKUPS個より多い場合、古いものから削除
    if (files.length > MAX_BACKUPS) {
      const filesToDelete = files.slice(MAX_BACKUPS);
      filesToDelete.forEach(file => {
        fs.unlinkSync(file.path);
        console.log(`古いバックアップを削除しました: ${file.name}`);
      });
    }
  } catch (error) {
    console.error('バックアップのクリーンアップエラー:', error);
  }
}

/**
 * バックアップ処理を実行
 */
async function performBackup() {
  try {
    console.log(`[${new Date().toISOString()}] 自動バックアップを開始します`);
    
    await createBackup();
    cleanupOldBackups();
    
    console.log(`[${new Date().toISOString()}] 自動バックアップが完了しました`);
  } catch (error) {
    console.error('バックアップ処理でエラーが発生しました:', error);
  }
}

/**
 * スケジューラーを開始
 */
export function startBackupScheduler() {
  // 毎日19:30に実行（日本時間を想定）
  // システムが19:30に起動していない場合は実行されない
  const task = cron.schedule('30 19 * * *', () => {
    performBackup();
  }, {
    timezone: 'Asia/Tokyo'
  });

  console.log('自動バックアップスケジューラーが起動しました（毎日19:30に実行）');
  
  return task;
}

/**
 * スケジューラーを停止
 */
export function stopBackupScheduler(task: ScheduledTask) {
  if (task) {
    task.stop();
    console.log('自動バックアップスケジューラーを停止しました');
  }
}
