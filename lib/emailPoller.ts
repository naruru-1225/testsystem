import fs from "fs";
import path from "path";
import { EmailService, ParsedEmail } from "./services/emailService";
import { emailConfigRepository, EmailConfig } from "./repositories/emailConfigRepository";
import { testRepository } from "./repositories/testRepository";
import { folderRepository } from "./repositories/folderRepository";
import db from "./db/db-instance";

// IDLE再接続間隔（20分 - サーバーの切断を防ぐ）
const IDLE_RECONNECT_INTERVAL = 20 * 60 * 1000;
// 再接続リトライ間隔（エラー時）
const RETRY_INTERVAL = 60 * 1000;

let emailService: EmailService | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
let processingQueue = false;

/**
 * メールポーリング（IMAP IDLE方式）を開始
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
  console.log("[EmailPoller] メール自動取込を開始...");

  await connectAndIdle(config);
}

/**
 * メールポーリングを停止
 */
export async function stopEmailPoller(): Promise<void> {
  isRunning = false;

  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  if (emailService) {
    try {
      await emailService.disconnect();
    } catch (e) {
      // 切断エラーは無視
    }
    emailService = null;
  }

  console.log("[EmailPoller] メール自動取込を停止");
}

/**
 * メールポーリングを再起動（設定変更時に呼ぶ）
 */
export async function restartEmailPoller(): Promise<void> {
  await stopEmailPoller();
  // 少し待ってから再接続
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await startEmailPoller();
}

/**
 * 手動でメールを取得（同時実行防止付き）
 */
let fetchLock = false;

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
        const result = await processEmails(emails, config);
        await service.disconnect();
        return result;
      } catch (error) {
        try { await service.disconnect(); } catch (e) { /* ignore */ }
        throw error;
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
 * IMAP接続 + IDLE待機
 */
async function connectAndIdle(config: EmailConfig): Promise<void> {
  try {
    emailService = new EmailService(config);
    await emailService.connect();

    // まず未読メールを処理
    const emails = await emailService.fetchRecentPDFs();
    if (emails.length > 0) {
      await processEmails(emails, config);
    }

    // IDLE待機開始
    await emailService.startIdle(async () => {
      // 新着メール検知時の処理
      if (processingQueue) return;
      processingQueue = true;

      try {
        // 少し待ってからフェッチ（複数メール到着対応）
        await new Promise((resolve) => setTimeout(resolve, 2000));

        if (emailService) {
          const newEmails = await emailService.fetchRecentPDFs();
          if (newEmails.length > 0) {
            await processEmails(newEmails, config);
          }
        }
      } catch (error: any) {
        console.error("[EmailPoller] 新着メール処理エラー:", error.message);
      } finally {
        processingQueue = false;
      }
    });

    // 20分ごとに再接続（IDLE接続維持のため）
    idleTimer = setTimeout(async () => {
      if (!isRunning) return;

      console.log("[EmailPoller] 定期再接続...");
      try {
        if (emailService) {
          await emailService.disconnect();
        }
      } catch (e) {
        // 切断エラーは無視
      }

      // 設定を再取得して接続
      const latestConfig = emailConfigRepository.get();
      if (latestConfig && latestConfig.enabled) {
        await connectAndIdle(latestConfig);
      } else {
        isRunning = false;
        console.log("[EmailPoller] 設定が無効化されたため停止");
      }
    }, IDLE_RECONNECT_INTERVAL);
  } catch (error: any) {
    console.error("[EmailPoller] 接続エラー:", error.message);

    // リトライ
    if (isRunning) {
      console.log(`[EmailPoller] ${RETRY_INTERVAL / 1000}秒後に再接続を試みます...`);
      idleTimer = setTimeout(async () => {
        const latestConfig = emailConfigRepository.get();
        if (latestConfig && latestConfig.enabled && isRunning) {
          await connectAndIdle(latestConfig);
        }
      }, RETRY_INTERVAL);
    }
  }
}

/**
 * 取得したメールを処理してテストとして登録
 */
async function processEmails(
  emails: ParsedEmail[],
  config: EmailConfig
): Promise<{ imported: number; errors: string[] }> {
  let imported = 0;
  const errors: string[] = [];

  for (const email of emails) {
    for (const attachment of email.attachments) {
      try {
        // 重複チェック
        const importKey = `${email.messageId}::${attachment.filename}`;
        if (emailConfigRepository.isImported(importKey)) {
          console.log(`[EmailPoller] スキップ（取込済み）: ${attachment.filename}`);
          continue;
        }

        // PDFを保存
        const uploadDir = path.join(process.cwd(), "public", "uploads", "pdfs");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 15);
        const safeFileName = `${timestamp}-${randomStr}.pdf`;
        const filePath = path.join(uploadDir, safeFileName);
        fs.writeFileSync(filePath, attachment.content);

        const publicPath = `/uploads/pdfs/${safeFileName}`;

        // フォルダ決定
        let folderId = config.default_folder_id;
        if (!folderId) {
          const uncategorized = folderRepository.getUncategorized();
          folderId = uncategorized?.id || 2;
        }

        // タグ取得 or 作成
        let tagId: number | null = null;
        if (config.default_tag_name) {
          const existingTag = db
            .prepare("SELECT id FROM tags WHERE name = ?")
            .get(config.default_tag_name) as { id: number } | undefined;

          if (existingTag) {
            tagId = existingTag.id;
          } else {
            const result = db
              .prepare("INSERT INTO tags (name, color) VALUES (?, ?)")
              .run(config.default_tag_name, "#F59E0B");
            tagId = result.lastInsertRowid as number;
          }
        }

        // テスト名の生成
        const nameBase = attachment.filename.replace(/\.pdf$/i, "") || email.subject;
        const testName = `${config.name_prefix} ${nameBase}`;

        // テスト登録
        const newTest = testRepository.create({
          name: testName,
          subject: config.default_subject || "未分類",
          grade: config.default_grade || "未設定",
          folderId: folderId!,
          description: `📧 メールから自動登録\n送信者: ${email.from}\n受信日時: ${email.date.toLocaleString("ja-JP")}\n件名: ${email.subject}`,
          pdfPath: publicPath,
          tagIds: tagId ? [tagId] : [],
          folderIds: [folderId!],
          attachments: [{
            fileName: attachment.filename,
            filePath: publicPath,
            mimeType: "application/pdf",
            fileSize: attachment.size,
          }],
        });

        // 取込ログに記録
        emailConfigRepository.addImportLog({
          messageId: importKey,
          uid: email.uid,
          subject: email.subject,
          fromAddress: email.from,
          fileName: attachment.filename,
          testId: newTest?.id || null,
          status: "success",
        });

        imported++;
        console.log(`[EmailPoller] ✅ 登録完了: ${testName}`);
      } catch (error: any) {
        const errorMsg = `${attachment.filename}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`[EmailPoller] ❌ 登録エラー:`, errorMsg);

        // エラーログ記録
        try {
          emailConfigRepository.addImportLog({
            messageId: `${email.messageId}::${attachment.filename}`,
            uid: email.uid,
            subject: email.subject,
            fromAddress: email.from,
            fileName: attachment.filename,
            testId: null,
            status: "error",
            errorMessage: error.message,
          });
        } catch (logError) {
          // ログ記録エラーは無視
        }
      }
    }
  }

  if (imported > 0) {
    console.log(`[EmailPoller] ${imported}件のPDFを自動登録しました`);
  }

  return { imported, errors };
}

/**
 * 現在のポーリング状態を取得
 */
export function getPollerStatus(): { running: boolean } {
  return { running: isRunning };
}
