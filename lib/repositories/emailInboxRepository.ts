import db from "../db/db-instance";

export interface EmailInboxItem {
  id: number;
  file_name: string;
  file_path: string;
  original_subject: string | null;
  from_address: string | null;
  received_at: string;
  message_id: string | null;
  status: "pending" | "assigned" | "error";
  error_message: string | null;
}

export const emailInboxRepository = {
  /**
   * 待機中のPDF一覧を取得
   */
  getPending(): EmailInboxItem[] {
    return db
      .prepare(
        "SELECT * FROM email_inbox WHERE status = 'pending' ORDER BY received_at DESC"
      )
      .all() as EmailInboxItem[];
  },

  /**
   * 全件取得（ステータス問わず）
   */
  getAll(): EmailInboxItem[] {
    return db
      .prepare("SELECT * FROM email_inbox ORDER BY received_at DESC LIMIT 200")
      .all() as EmailInboxItem[];
  },

  /**
   * 待機件数を取得
   */
  getPendingCount(): number {
    const result = db
      .prepare("SELECT COUNT(*) as count FROM email_inbox WHERE status = 'pending'")
      .get() as { count: number };
    return result.count;
  },

  /**
   * PDFを受信トレイに追加
   */
  add(item: {
    file_name: string;
    file_path: string;
    original_subject?: string;
    from_address?: string;
    message_id?: string;
  }): EmailInboxItem {
    const result = db
      .prepare(
        `INSERT INTO email_inbox (file_name, file_path, original_subject, from_address, message_id)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        item.file_name,
        item.file_path,
        item.original_subject ?? null,
        item.from_address ?? null,
        item.message_id ?? null
      );
    return db
      .prepare("SELECT * FROM email_inbox WHERE id = ?")
      .get(result.lastInsertRowid) as EmailInboxItem;
  },

  /**
   * ステータスを更新
   */
  updateStatus(id: number, status: "pending" | "assigned" | "error", errorMessage?: string): void {
    db.prepare(
      "UPDATE email_inbox SET status = ?, error_message = ? WHERE id = ?"
    ).run(status, errorMessage ?? null, id);
  },

  /**
   * 削除
   */
  delete(id: number): void {
    const item = db.prepare("SELECT * FROM email_inbox WHERE id = ?").get(id) as EmailInboxItem | undefined;
    if (item) {
      // ファイル削除（assignedでない場合のみ）
      if (item.status !== "assigned") {
        try {
          const fs = require("fs");
          const path = require("path");
          const fullPath = path.join(process.cwd(), "public", item.file_path);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } catch (_e) {
          // ファイル削除エラーは無視
        }
      }
      db.prepare("DELETE FROM email_inbox WHERE id = ?").run(id);
    }
  },

  /**
   * 複数削除
   */
  deleteMany(ids: number[]): void {
    for (const id of ids) {
      this.delete(id);
    }
  },

  /**
   * message_idで重複チェック
   */
  isImported(messageId: string): boolean {
    const result = db
      .prepare("SELECT id FROM email_inbox WHERE message_id = ?")
      .get(messageId) as { id: number } | undefined;
    return !!result;
  },
};
