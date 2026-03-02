/**
 * Next.js Instrumentation Hook
 * Next.js 14.0.4+ で自動ロードされる（設定不要）
 *
 * このファイルはサーバー起動時に最初に実行される。
 * IMAP 関連の uncaughtException / unhandledRejection から
 * プロセスを守る保護ハンドラを登録する。
 */
export async function register() {
  // Node.js サーバーサイドのみ（Edge Runtime では不要）
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const isImapError = (error: any): boolean =>
      error?.code === "ETIMEOUT" ||
      error?.message === "Socket timeout" ||
      (typeof error?.message === "string" &&
        error.message.includes("Socket timeout"));

    // uncaughtException: 既存ハンドラより先に実行されるよう prependListener を使用
    // （既存ハンドラは削除しない）
    process.prependListener("uncaughtException", (error: any) => {
      if (isImapError(error)) {
        console.error(
          "[Guard] uncaughtException: IMAP Socket timeout を捕捉しました（プロセス継続）:",
          error.message
        );
        // process.exit() を呼ばない → 後続ハンドラも実行しない
        // 後続ハンドラを止めるには removeAllListeners は使えないため
        // このハンドラが捕捉した場合は throw で止める代わりに
        // setImmediate で後続スタックをスキップする方法は取れないが、
        // Node.js は uncaughtException リスナーが存在するだけでデフォルトの
        // process.exit を抑制するため、このハンドラだけで十分。
        return;
      }
    });

    // unhandledRejection: Node.js 22 ではデフォルトで process.exit するため保護必須
    process.prependListener("unhandledRejection", (reason: any) => {
      if (isImapError(reason)) {
        console.error(
          "[Guard] unhandledRejection: IMAP Socket timeout を捕捉しました（プロセス継続）:",
          reason?.message ?? reason
        );
        return;
      }
      // その他の unhandledRejection はログのみ（Next.js に処理を委ねる）
      console.error("[Guard] unhandledRejection:", reason);
    });

    console.log(
      "[Guard] uncaughtException / unhandledRejection 保護ハンドラを登録しました"
    );
  }
}
