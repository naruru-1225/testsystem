import db from "../db/db-instance";

export interface EmailConfig {
  id: number;
  imap_host: string;
  imap_port: number;
  imap_user: string;
  imap_password: string;
  enabled: number; // 0 or 1
  default_subject: string;
  default_grade: string;
  default_folder_id: number | null;
  default_tag_name: string;
  name_prefix: string;
  updated_at: string;
}

export interface EmailImportLog {
  id: number;
  message_id: string;
  uid: number;
  subject: string;
  from_address: string;
  file_name: string;
  test_id: number | null;
  status: string;
  error_message: string | null;
  imported_at: string;
}

export const emailConfigRepository = {
  /**
   * メール設定を取得（1レコードのみ）
   */
  get(): EmailConfig | null {
    return db.prepare("SELECT * FROM email_config WHERE id = 1").get() as EmailConfig | null;
  },

  /**
   * メール設定を保存（UPSERT）
   */
  save(config: Partial<EmailConfig>): EmailConfig {
    const existing = this.get();

    if (existing) {
      db.prepare(`
        UPDATE email_config SET
          imap_host = COALESCE(?, imap_host),
          imap_port = COALESCE(?, imap_port),
          imap_user = COALESCE(?, imap_user),
          imap_password = COALESCE(?, imap_password),
          enabled = COALESCE(?, enabled),
          default_subject = COALESCE(?, default_subject),
          default_grade = COALESCE(?, default_grade),
          default_folder_id = ?,
          default_tag_name = COALESCE(?, default_tag_name),
          name_prefix = COALESCE(?, name_prefix),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(
        config.imap_host ?? null,
        config.imap_port ?? null,
        config.imap_user ?? null,
        config.imap_password ?? null,
        config.enabled ?? null,
        config.default_subject ?? null,
        config.default_grade ?? null,
        config.default_folder_id !== undefined ? config.default_folder_id : existing.default_folder_id,
        config.default_tag_name ?? null,
        config.name_prefix ?? null,
      );
    } else {
      db.prepare(`
        INSERT INTO email_config (id, imap_host, imap_port, imap_user, imap_password, enabled, default_subject, default_grade, default_folder_id, default_tag_name, name_prefix)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        config.imap_host || "imap.gmail.com",
        config.imap_port || 993,
        config.imap_user || "",
        config.imap_password || "",
        config.enabled ?? 0,
        config.default_subject || "未分類",
        config.default_grade || "未設定",
        config.default_folder_id || null,
        config.default_tag_name || "自動登録",
        config.name_prefix || "[自動登録]",
      );
    }

    return this.get()!;
  },

  /**
   * 取込ログを追加
   */
  addImportLog(log: {
    messageId: string;
    uid: number;
    subject: string;
    fromAddress: string;
    fileName: string;
    testId: number | null;
    status: string;
    errorMessage?: string;
  }): number {
    const result = db.prepare(`
      INSERT INTO email_import_log (message_id, uid, subject, from_address, file_name, test_id, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      log.messageId,
      log.uid,
      log.subject,
      log.fromAddress,
      log.fileName,
      log.testId,
      log.status,
      log.errorMessage || null,
    );
    return result.lastInsertRowid as number;
  },

  /**
   * Message-IDで取込済みか確認
   */
  isImported(messageId: string): boolean {
    const row = db.prepare(
      "SELECT id FROM email_import_log WHERE message_id = ? AND status = 'success'"
    ).get(messageId);
    return !!row;
  },

  /**
   * 取込ログ一覧（最新順）
   */
  getImportLogs(limit: number = 20): EmailImportLog[] {
    return db.prepare(
      "SELECT * FROM email_import_log ORDER BY imported_at DESC LIMIT ?"
    ).all(limit) as EmailImportLog[];
  },

  /**
   * 取込ログのステータス別カウント
   */
  getImportStats(): { total: number; success: number; error: number } {
    const row = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error
      FROM email_import_log
    `).get() as { total: number; success: number; error: number };
    return row;
  },
};
