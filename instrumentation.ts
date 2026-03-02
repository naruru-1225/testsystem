/**
 * Next.js Instrumentation Hook
 * Next.js 14.0.4+ で自動ロードされる（設定不要）
 *
 * このファイルはサーバー起動時に最初に実行される。
 * IMAP ソケットタイムアウトによる uncaughtException からプロセスを守る
 * 最後の防衛線として process レベルのハンドラを登録する。
 */
export async function register() {
  // Node.js サーバーサイドのみ（Edge Runtime では不要）
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // setImmediate で Next.js が自身のハンドラを登録し終えた後に実行
    setImmediate(() => {
      const existingHandlers = process.listeners(
        "uncaughtException"
      ) as Function[];

      // 既存ハンドラを一旦全て外し、ETIMEOUT を安全に吸収する
      // 統合ハンドラで再登録する
      process.removeAllListeners("uncaughtException");

      process.on("uncaughtException", (error: any, origin: string) => {
        const isSocketTimeout =
          error?.code === "ETIMEOUT" ||
          error?.message === "Socket timeout" ||
          (typeof error?.message === "string" &&
            error.message.includes("Socket timeout"));

        if (isSocketTimeout) {
          // IMAP ソケットタイムアウトは致命的エラーではない。
          // emailPoller の再接続タイマーが自動回復する。
          console.error(
            "[Guard] IMAP Socket timeout を捕捉しました（プロセス継続）:",
            error.message
          );
          return; // process.exit() を呼ばない → プロセスは継続
        }

        // その他の本当の致命的エラーは元のハンドラ群に委ねる
        for (const handler of existingHandlers) {
          try {
            (handler as any)(error, origin);
          } catch {
            // 元のハンドラが再スローしても無視（無限ループ防止）
          }
        }

        // 元のハンドラが process.exit を呼ばなかった場合はここで終了
        process.exit(1);
      });

      console.log(
        "[Guard] uncaughtException ハンドラを登録しました（IMAP ETIMEOUT 保護）"
      );
    });
  }
}
