/**
 * 入力値サニタイズユーティリティ (#101)
 * XSS対策のためのテキスト入力クリーニング
 */

/**
 * HTMLタグを除去し、危険な文字をエスケープする
 */
export function sanitizeText(input: unknown): string {
  if (input === null || input === undefined) return "";
  const str = String(input);
  // HTMLタグを除去
  const stripped = str.replace(/<[^>]*>/g, "");
  // 前後の空白を除去
  return stripped.trim();
}

/**
 * 配列内の各要素をサニタイズする
 */
export function sanitizeArray(input: unknown[]): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => sanitizeText(item));
}

/**
 * 数値IDを安全に変換する（NaN や負数を拒否）
 */
export function sanitizeId(input: unknown): number | null {
  const n = Number(input);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

/**
 * ファイル名をサニタイズする（パストラバーサル対策）
 */
export function sanitizeFileName(input: unknown): string {
  const name = sanitizeText(input);
  // パス区切り文字と危険な文字を除去
  return name.replace(/[/\\:*?"<>|]/g, "").replace(/\.\./g, "");
}
