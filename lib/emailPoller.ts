import crypto from "crypto";
import fs from "fs";
import path from "path";
import { EmailService, ParsedEmail } from "./services/emailService";
import { emailConfigRepository, EmailConfig } from "./repositories/emailConfigRepository";
import { emailInboxRepository } from "./repositories/emailInboxRepository";

// ポーリング間隔（5分）
// IDLE方式は ImapFlow のロック管理に問題があるためシンプルなポーリングに変更
const POLL_INTERVAL = 5 * 60 * 1000;
// エラー時の再試行間隔（60秒）
const RETRY_INTERVAL = 60 * 1000;

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
let fetchLock = false;

/**
 * メールポーリング（5分間隔）を開始
 */
export async function startEmailPoller(): Promise<void> {
  const config = emailConfigRepository.get();

  if (!config || !config.enabled || !config.imap_user || !config.imap_password) {
    console.log("[EmailPoller] メール取込が無効か、設定が不完全です。");
    return;
  }

  if (isRunning) {
    console.log("[EmailPoller] 既に実行中です。");
    return;
  }

  isRunning = true;
  console.log("[EmailPoller] メール自動取込を開始 (5分間隔ポーリング)...");

  // 起動直後に1回実行してから以後5分おきに繰り返す
  schedulePoll(0);
}

/**
 * 次回ポーリングをスケジュール
 */
function schedulePoll(delayMs: number): void {
  if (!isRunning) return;
  pollTimer = setTimeout(() => {
    runPoll().catch((err: any) => {
      console.error("[EmailPoller] ポーリングエラー:", err?.message ?? err);
      // エラー時は短いインターバルで再試行
      schedulePoll(RETRY_INTERVAL);
    });
  }, delayMs);
}

/**
 * 1回のポーリング: 接続→取得→切断 (ステートレス)
 */
async function runPoll(): Promise<void> {
  const config = emailConfigRepository.get();

  if (!config || !config.enabled) {
    isRunning = false;
    console.log("[EmailPoller] 設定が無効化されたため停止");
    return;
  }

  if (!isRunning) return;

  const service = new EmailService(config);
  try {
    await service.connect();
    const emails = await service.fetchRecentPDFs();
    if (emails.length > 0) {
      await processEmails(emails, config);
    }
  } finally {
    // 成功・失敗問わず必ず切断（リークしない）
    try { await service.disconnect(); } catch (_) { /* ignore */ }
  }

  // 次回スケジュール
  schedulePoll(POLL_INTERVAL);
}

/**
 * メールポーリングを停止
 */
export async function stopEmailPoller(): Promise<void> {
  isRunning = false;

  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }

  console.log("[EmailPoller] メール自動取込を停止");
}

/**
 * メールポーリングを再起動（設定変更時に呼ぶ）
 */
export async function restartEmailPoller(): Promise<void> {
  await stopEmailPoller();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await startEmailPoller();
}

/**
 * 手動でメールを取得（同時実行防止付き）
 */
export async function manualFetch(): Promise<{ imported: number; errors: string[] }> {
  if (fetchLock) {
    return { imported: 0, errors: ["既に取り込み処理中です。しばらくお待ちください。"] };
  }

  fetchLock = true;
  try {
    const config = emailConfigRepository.get();

    if (!config || !config.imap_user || !config.imap_password) {
      throw new Error("メール設定が不完全です");
    }

    // 全体タイムアウト: 60秒
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("メール取得がタイムアウトしました（60秒）")), 60000);
    });

    const fetchPromise = async () => {
      const service = new EmailService(config);
      try {
        await service.connect();
        const emails = await service.fetchRecentPDFs();
        return await processEmails(emails, config);
      } finally {
        try { await service.disconnect(); } catch (_) { /* ignore */ }
      }
    };

    return await Promise.race([fetchPromise(), timeoutPromise]);
  } finally {
    fetchLock = false;
  }
}

/**
 * 接続テスト
 */
export async function testConnection(config: EmailConfig): Promise<{ success: boolean; error?: string }> {
  const service = new EmailService(config);
  return service.testConnection();
}

/**
 * 取得したメールを受信トレイ（pending）に保存
 */
async function processEmails(
  emails: ParsedEmail[],
  _config: EmailConfig
): Promise<{ imported: number; errors: string[] }> {
  let imported = 0;
  const errors: string[] = [];

  for (const email of emails) {
    for (const attachment of email.attachments) {
      try {
        // 重複チェック（email_inboxとemail_import_log両方）
        const importKey = `${email.messageId}::${attachment.filename}`;
        if (
          emailConfigRepository.isImported(importKey) ||
          emailInboxRepository.isImported(importKey)
        ) {
          console.log(`[EmailPoller] スキップ（取込済み）: ${attachment.filename}`);
          continue;
        }

        // コンテンツハッシュで重複チェック
        const contentHash = crypto.createHash("sha256").update(attachment.content).digest("hex");
        if (emailInboxRepository.isDuplicateByHash(contentHash)) {
          console.log(`[EmailPoller] スキップ（コンテンツ重複）: ${attachment.filename}`);
          continue;
        }

        // PDFを受信トレイ用ディレクトリに保存
        const inboxDir = path.join(process.cwd(), "public", "uploads", "pdfs", "inbox");
        if (!fs.existsSync(inboxDir)) {
          fs.mkdirSync(inboxDir, { recursive: true });
        }

        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 15);
        const safeFileName = `${timestamp}-${randomStr}.pdf`;
        const filePath = path.join(inboxDir, safeFileName);
        fs.writeFileSync(filePath, attachment.content);

        const publicPath = `/uploads/pdfs/inbox/${safeFileName}`;

        // 受信トレイに追加（pending状態）
        emailInboxRepository.add({
          file_name: attachment.filename,
          file_path: publicPath,
          original_subject: email.subject,
          from_address: email.from,
          message_id: importKey,
          content_hash: contentHash,
        });

        imported++;
        console.log(`[EmailPoller] ✅ 受信トレイに追加: ${attachment.filename}`);
      } catch (error: any) {
        const errorMsg = `${attachment.filename}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`[EmailPoller] ❌ 取込エラー:`, errorMsg);
      }
    }
  }

  if (imported > 0) {
    console.log(`[EmailPoller] ${imported}件のPDFを受信トレイに追加しました`);
  }

  return { imported, errors };
}

/**
 * 現在のポーリング状態を取得
 */
export function getPollerStatus(): { running: boolean } {
  return { running: isRunning };
}
