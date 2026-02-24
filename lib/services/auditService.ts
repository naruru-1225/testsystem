/**
 * 監査ログサービス (#103)
 * 操作履歴を記録する（どの端末からいつ何をしたか）
 */
import db from "../db/db-instance";

export type AuditAction = "create" | "update" | "delete" | "view" | "upload" | "restore";

export interface AuditLogEntry {
  id: number;
  action: AuditAction;
  target_type: string;  // "test" | "folder" | "grade" | etc.
  target_id: number | null;
  target_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_hint: string | null;  // 端末種別ヒント (PC/iPad/スマートフォン等)
  created_at: string;
}

/** user-agent から端末ヒントを生成 */
function getDeviceHint(userAgent: string | null): string {
  if (!userAgent) return "不明";
  const ua = userAgent.toLowerCase();
  if (ua.includes("ipad")) return "iPad";
  if (ua.includes("iphone")) return "iPhone";
  if (ua.includes("android") && ua.includes("mobile")) return "Androidスマートフォン";
  if (ua.includes("android")) return "Androidタブレット";
  if (ua.includes("windows")) return "Windows PC";
  if (ua.includes("macintosh") || ua.includes("mac os")) return "Mac";
  if (ua.includes("linux")) return "Linux PC";
  return "その他の端末";
}

export const auditService = {
  /**
   * 操作ログを記録する
   */
  log: (
    action: AuditAction,
    targetType: string,
    targetId: number | null,
    targetName: string | null,
    request?: Request
  ) => {
    try {
      const ip = request
        ? (
            (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
            request.headers.get("x-real-ip") ||
            "unknown"
          )
        : null;
      const userAgent = request ? request.headers.get("user-agent") : null;
      const deviceHint = getDeviceHint(userAgent);

      db.prepare(`
        INSERT INTO audit_log (action, target_type, target_id, target_name, ip_address, user_agent, device_hint)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(action, targetType, targetId, targetName, ip, userAgent?.slice(0, 500) ?? null, deviceHint);
    } catch {
      // ログ書き込みエラーは無視（本来の処理を妨げない）
    }
  },

  /**
   * 最近のログを取得する
   */
  getRecent: (limit = 50): AuditLogEntry[] => {
    return db.prepare(
      "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?"
    ).all(limit) as AuditLogEntry[];
  },
};
