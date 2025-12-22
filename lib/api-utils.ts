import { NextResponse } from "next/server";

type ApiHandler = (request: Request, context?: any) => Promise<NextResponse>;

/**
 * APIルートのエラーハンドリングを共通化するラッパー関数
 * @param handler APIハンドラー関数
 * @returns エラーハンドリング付きのAPIハンドラー
 */
export function withErrorHandling(handler: ApiHandler): ApiHandler {
  return async (request: Request, context?: any) => {
    try {
      return await handler(request, context);
    } catch (error: any) {
      console.error("API Error:", error);
      
      // エラーメッセージの取得
      const message = error.message || "Internal Server Error";
      
      // ステータスコードの決定 (エラーオブジェクトにstatusプロパティがあればそれを使用)
      const status = error.status || 500;

      return NextResponse.json(
        { error: message },
        { status }
      );
    }
  };
}

/**
 * バリデーションエラーレスポンスを生成する
 * @param message エラーメッセージ
 * @returns NextResponse
 */
export function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * リソースが見つからない場合のエラーレスポンスを生成する
 * @param message エラーメッセージ
 * @returns NextResponse
 */
export function notFoundError(message: string = "Resource not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}
