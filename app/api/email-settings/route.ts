import { NextResponse } from "next/server";
import { emailConfigRepository } from "@/lib/repositories/emailConfigRepository";
import { testConnection, restartEmailPoller, stopEmailPoller, getPollerStatus } from "@/lib/emailPoller";
import { withErrorHandling } from "@/lib/api-utils";

/**
 * メール設定取得API
 * GET /api/email-settings
 */
export const GET = withErrorHandling(async () => {
  const config = emailConfigRepository.get();
  const status = getPollerStatus();
  const logs = emailConfigRepository.getImportLogs(20);
  const stats = emailConfigRepository.getImportStats();

  return NextResponse.json({
    config: config
      ? {
          ...config,
          // パスワードはマスクして返す
          imap_password: config.imap_password ? "********" : "",
        }
      : null,
    status,
    logs,
    stats,
  });
});

/**
 * メール設定保存API
 * PUT /api/email-settings
 */
export const PUT = withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const {
    imap_host,
    imap_port,
    imap_user,
    imap_password,
    enabled,
    default_subject,
    default_grade,
    default_folder_id,
    default_tag_name,
    name_prefix,
  } = body;

  // パスワードが"********"の場合は更新しない
  const updateData: any = {
    imap_host,
    imap_port,
    imap_user,
    enabled,
    default_subject,
    default_grade,
    default_folder_id,
    default_tag_name,
    name_prefix,
  };

  if (imap_password && imap_password !== "********") {
    updateData.imap_password = imap_password;
  }

  const saved = emailConfigRepository.save(updateData);

  // 有効/無効の切り替えに応じてポーラーを制御
  if (saved.enabled) {
    await restartEmailPoller();
  } else {
    await stopEmailPoller();
  }

  return NextResponse.json({
    success: true,
    config: {
      ...saved,
      imap_password: saved.imap_password ? "********" : "",
    },
  });
});

/**
 * 接続テストAPI
 * POST /api/email-settings
 */
export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const { action } = body;

  if (action === "test") {
    // 接続テスト
    const { imap_host, imap_port, imap_user, imap_password } = body;

    // パスワードがマスクされている場合はDBから取得
    let actualPassword = imap_password;
    if (imap_password === "********") {
      const config = emailConfigRepository.get();
      actualPassword = config?.imap_password || "";
    }

    const result = await testConnection({
      imap_host: imap_host || "imap.gmail.com",
      imap_port: imap_port || 993,
      imap_user: imap_user || "",
      imap_password: actualPassword,
    } as any);

    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "不明なアクション" }, { status: 400 });
});
