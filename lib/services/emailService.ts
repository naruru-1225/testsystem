import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { ParsedMail } from "mailparser";
import type { EmailConfig } from "../repositories/emailConfigRepository";

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  size: number;
}

export interface ParsedEmail {
  messageId: string;
  uid: number;
  subject: string;
  from: string;
  date: Date;
  attachments: EmailAttachment[];
}

/**
 * IMAP接続・メール取得サービス
 */
export class EmailService {
  private client: ImapFlow | null = null;
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
  }

  /**
   * IMAP接続を確立
   */
  async connect(): Promise<void> {
    this.client = new ImapFlow({
      host: this.config.imap_host,
      port: this.config.imap_port,
      secure: true,
      auth: {
        user: this.config.imap_user,
        pass: this.config.imap_password,
      },
      logger: false, // ログ出力を抑制
      connectionTimeout: 30000, // 接続タイムアウト: 30秒
    });

    await this.client.connect();
    console.log(`[Email] IMAP接続成功: ${this.config.imap_user}`);
  }

  /**
   * 接続を閉じる
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.logout();
      this.client = null;
      console.log("[Email] IMAP切断");
    }
  }

  /**
   * 接続テスト
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const testClient = new ImapFlow({
        host: this.config.imap_host,
        port: this.config.imap_port,
        secure: true,
        auth: {
          user: this.config.imap_user,
          pass: this.config.imap_password,
        },
        logger: false,
        connectionTimeout: 15000, // 接続テスト用タイムアウト: 15秒
      });

      await testClient.connect();
      await testClient.logout();
      return { success: true };
    } catch (error: any) {
      console.error("[Email] 接続テスト失敗:", error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 未読メールからPDF添付を取得
   * 直近7日間の未読メールのみ対象、最大10件まで
   */
  async fetchUnreadPDFs(): Promise<ParsedEmail[]> {
    if (!this.client) {
      throw new Error("IMAP未接続です");
    }

    const results: ParsedEmail[] = [];

    // INBOXを開く
    const lock = await this.client.getMailboxLock("INBOX");

    try {
      // 7日前の日付を計算
      const since = new Date();
      since.setDate(since.getDate() - 7);

      console.log(`[Email] 未読メール検索中... (${since.toLocaleDateString('ja-JP')} 以降)`);

      // 未読(UNSEEN) かつ 直近7日間のメールを検索
      const messages = this.client.fetch(
        { seen: false, since },
        {
          uid: true,
          envelope: true,
          source: true,
        }
      );

      let count = 0;
      const MAX_MESSAGES = 10;

      for await (const msg of messages) {
        if (count >= MAX_MESSAGES) {
          console.log(`[Email] 最大取得件数(${MAX_MESSAGES})に達しました`);
          break;
        }

        try {
          if (!msg.source) {
            console.warn(`[Email] ソースが空のメール (UID: ${msg.uid}), スキップ`);
            continue;
          }
          const parsed: ParsedMail = await simpleParser(msg.source) as ParsedMail;
          const pdfAttachments = this.extractPDFs(parsed);

          if (pdfAttachments.length > 0) {
            results.push({
              messageId: parsed.messageId || `uid-${msg.uid}`,
              uid: msg.uid,
              subject: parsed.subject || "件名なし",
              from: parsed.from?.text || "不明",
              date: parsed.date || new Date(),
              attachments: pdfAttachments,
            });
            console.log(`[Email] PDF添付メール発見: "${parsed.subject}" (${pdfAttachments.length}件のPDF)`);
          }

          // メールを既読にマーク
          await this.client!.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], { uid: true });
          count++;
        } catch (parseError: any) {
          console.error(`[Email] メール解析エラー (UID: ${msg.uid}):`, parseError.message);
          count++;
        }
      }

      console.log(`[Email] ${count}件のメールを処理、${results.length}件にPDF添付あり`);
    } finally {
      lock.release();
    }

    return results;
  }

  /**
   * IDLE待機（新着メール通知）
   * コールバックが呼ばれた時はINBOXに変更あり
   */
  async startIdle(onNewMail: () => void): Promise<void> {
    if (!this.client) {
      throw new Error("IMAP未接続です");
    }

    // INBOXを開く
    const lock = await this.client.getMailboxLock("INBOX");

    try {
      // existsイベント: 新着メール
      this.client.on("exists", (data: { path: string; count: number; prevCount: number }) => {
        console.log(`[Email] 新着メール検知: ${data.count - data.prevCount}通`);
        onNewMail();
      });

      // IDLE開始（サーバーからの通知を待つ）
      // imapflowは自動的にIDLEを管理する
      console.log("[Email] IDLE待機開始");
    } catch (error) {
      lock.release();
      throw error;
    }
  }

  /**
   * ImapFlow clientを取得
   */
  getClient(): ImapFlow | null {
    return this.client;
  }

  /**
   * メールからPDF添付ファイルを抽出
   */
  private extractPDFs(parsed: ParsedMail): EmailAttachment[] {
    if (!parsed.attachments || parsed.attachments.length === 0) {
      return [];
    }

    return parsed.attachments
      .filter((att) => {
        const isPdf =
          att.contentType === "application/pdf" ||
          att.filename?.toLowerCase().endsWith(".pdf");
        return isPdf && att.content && att.content.length > 0;
      })
      .map((att) => ({
        filename: att.filename || "attachment.pdf",
        content: att.content,
        contentType: att.contentType,
        size: att.size,
      }));
  }
}
