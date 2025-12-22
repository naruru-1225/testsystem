/**
 * ユーティリティ関数集
 * 共通で使用する汎用的な関数を定義
 */

import type { Folder } from "@/types/database";

/**
 * 日付を日本語形式（YYYY/MM/DD）でフォーマット
 * @param dateString 日付文字列
 * @returns フォーマットされた日付文字列
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch (error) {
    console.error("日付フォーマットエラー:", error);
    return dateString;
  }
}

/**
 * 日付を詳細な日本語形式（YYYY年MM月DD日 HH:MM）でフォーマット
 * @param dateString 日付文字列
 * @returns フォーマットされた日付文字列
 */
export function formatDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    console.error("日時フォーマットエラー:", error);
    return dateString;
  }
}

/**
 * フォルダツリーを構築する
 * フラットな配列を親子関係のあるツリー構造に変換
 * @param folders フォルダ配列
 * @returns ルートフォルダの配列と子フォルダのマップ
 */
export function buildFolderTree(folders: Folder[]): {
  rootFolders: Folder[];
  childMap: Map<number, Folder[]>;
} {
  const childMap = new Map<number, Folder[]>();
  const rootFolders: Folder[] = [];

  // 親IDごとに子フォルダをグループ化
  folders.forEach((folder) => {
    if (!folder.parent_id) {
      // 親IDがnullの場合はルートフォルダ
      rootFolders.push(folder);
    } else {
      // 親IDがある場合は子フォルダとしてマップに追加
      if (!childMap.has(folder.parent_id)) {
        childMap.set(folder.parent_id, []);
      }
      childMap.get(folder.parent_id)!.push(folder);
    }
  });

  // 各配列をorder_indexでソート
  rootFolders.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  childMap.forEach((children) => {
    children.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  });

  return { rootFolders, childMap };
}

/**
 * ファイルサイズを人間が読みやすい形式に変換
 * @param bytes バイト数
 * @returns フォーマットされたファイルサイズ文字列
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * 配列から重複を削除
 * @param array 配列
 * @returns 重複を削除した配列
 */
export function removeDuplicates<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

/**
 * オブジェクトの配列から重複を削除（キーベース）
 * @param array 配列
 * @param key 重複判定に使用するキー
 * @returns 重複を削除した配列
 */
export function removeDuplicatesByKey<T>(array: T[], key: keyof T): T[] {
  const seen = new Set();
  return array.filter((item) => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

/**
 * URLからファイル名を抽出
 * @param url URL文字列
 * @returns ファイル名
 */
export function extractFilename(url: string): string {
  try {
    const parts = url.split("/");
    return decodeURIComponent(parts[parts.length - 1]);
  } catch (error) {
    console.error("ファイル名抽出エラー:", error);
    return url;
  }
}

/**
 * ファイル拡張子を取得
 * @param filename ファイル名
 * @returns 拡張子（ドット含む）
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot === -1 ? "" : filename.slice(lastDot);
}

/**
 * クラス名を条件付きで結合
 * @param classes クラス名の配列（falsy値は無視される）
 * @returns 結合されたクラス名文字列
 */
export function classNames(
  ...classes: (string | boolean | undefined | null)[]
): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * 配列を指定されたサイズのチャンクに分割
 * @param array 配列
 * @param size チャンクサイズ
 * @returns チャンクの配列
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * オブジェクトから空の値を削除
 * @param obj オブジェクト
 * @returns 空でない値のみを持つオブジェクト
 */
export function removeEmptyValues<T extends Record<string, any>>(
  obj: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([_, value]) => value !== null && value !== undefined && value !== ""
    )
  ) as Partial<T>;
}

/**
 * 文字列を指定された長さで切り詰め
 * @param str 文字列
 * @param maxLength 最大長
 * @param suffix 切り詰められた場合に追加する接尾辞
 * @returns 切り詰められた文字列
 */
export function truncateString(
  str: string,
  maxLength: number,
  suffix: string = "..."
): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * 配列をソートする（イミュータブル）
 * @param array 配列
 * @param key ソートキー
 * @param order ソート順（'asc' or 'desc'）
 * @returns ソートされた新しい配列
 */
export function sortBy<T>(
  array: T[],
  key: keyof T,
  order: "asc" | "desc" = "asc"
): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];

    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    const comparison = aVal < bVal ? -1 : 1;
    return order === "asc" ? comparison : -comparison;
  });
}

/**
 * 配列内の要素を移動
 * @param array 配列
 * @param fromIndex 移動元のインデックス
 * @param toIndex 移動先のインデックス
 * @returns 要素が移動された新しい配列
 */
export function moveArrayItem<T>(
  array: T[],
  fromIndex: number,
  toIndex: number
): T[] {
  const newArray = [...array];
  const [removed] = newArray.splice(fromIndex, 1);
  newArray.splice(toIndex, 0, removed);
  return newArray;
}

/**
 * エラーメッセージを取得（Errorオブジェクトまたは文字列から）
 * @param error エラーオブジェクトまたは文字列
 * @returns エラーメッセージ
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "不明なエラーが発生しました";
}

/**
 * 安全にJSONをパース
 * @param jsonString JSON文字列
 * @param defaultValue パースに失敗した場合のデフォルト値
 * @returns パースされたオブジェクトまたはデフォルト値
 */
export function safeJsonParse<T>(jsonString: string, defaultValue: T): T {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("JSON解析エラー:", error);
    return defaultValue;
  }
}

/**
 * Promiseを指定時間待機
 * @param ms 待機時間（ミリ秒）
 * @returns Promise
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * リトライ機能付きで関数を実行
 * @param fn 実行する関数
 * @param maxRetries 最大リトライ回数
 * @param delayMs リトライ間の待機時間（ミリ秒）
 * @returns 関数の実行結果
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < maxRetries - 1) {
        await sleep(delayMs * (i + 1)); // 指数バックオフ
      }
    }
  }

  throw lastError || new Error("リトライ失敗");
}

/**
 * 検索クエリで配列をフィルタリング
 * @param items 配列
 * @param query 検索クエリ
 * @param keys 検索対象のキー
 * @returns フィルタリングされた配列
 */
export function filterByQuery<T extends Record<string, any>>(
  items: T[],
  query: string,
  keys: (keyof T)[]
): T[] {
  if (!query.trim()) return items;

  const lowerQuery = query.toLowerCase();
  return items.filter((item) =>
    keys.some((key) => {
      const value = item[key];
      return value && String(value).toLowerCase().includes(lowerQuery);
    })
  );
}

/**
 * フォルダツリーを検索クエリでフィルタリング
 *
 * @description
 * ツリー構造のフォルダリストを検索クエリで絞り込みます。
 * - クエリに一致するフォルダ本体
 * - クエリに一致する子孫を持つ親フォルダ
 * を含むように再帰的にフィルタリングします。
 *
 * @param folders ルートフォルダの配列
 * @param childMap 親IDをキーとする子フォルダのMap
 * @param query 検索クエリ（部分一致、大文字小文字区別なし）
 * @returns フィルタリングされたルートフォルダ配列と子マップ
 */
export function filterFolderTree(
  folders: Folder[],
  childMap: Map<number, Folder[]>,
  query: string
): {
  filteredFolders: Folder[];
  filteredChildMap: Map<number, Folder[]>;
} {
  // クエリが空の場合は全てを返す
  if (!query.trim()) {
    return { filteredFolders: folders, filteredChildMap: childMap };
  }

  const lowerQuery = query.toLowerCase();
  const filteredChildMap = new Map<number, Folder[]>();

  /**
   * フォルダとその子孫が検索クエリに一致するかチェック
   * @param folder チェック対象のフォルダ
   * @returns 一致する場合true
   */
  const matchesQueryOrHasMatchingChild = (folder: Folder): boolean => {
    // フォルダ名が一致するか
    if (folder.name.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // 子フォルダを持つ場合、再帰的にチェック
    const children = childMap.get(folder.id);
    if (children && children.length > 0) {
      return children.some((child) => matchesQueryOrHasMatchingChild(child));
    }

    return false;
  };

  /**
   * フォルダをフィルタリングして新しいchildMapを構築
   * @param folder フィルタリング対象のフォルダ
   * @returns フィルタリングされた場合true
   */
  const filterAndBuildMap = (folder: Folder): boolean => {
    const children = childMap.get(folder.id);

    if (!children || children.length === 0) {
      // 子がいない場合は自身の名前のみでチェック
      return folder.name.toLowerCase().includes(lowerQuery);
    }

    // 子フォルダを再帰的にフィルタリング
    const matchingChildren = children.filter((child) =>
      filterAndBuildMap(child)
    );

    // 自身が一致するか、子に一致するものがあるか
    const selfMatches = folder.name.toLowerCase().includes(lowerQuery);
    const hasMatchingChildren = matchingChildren.length > 0;

    if (selfMatches || hasMatchingChildren) {
      // 一致する子があれば filteredChildMap に追加
      if (matchingChildren.length > 0) {
        filteredChildMap.set(folder.id, matchingChildren);
      }
      return true;
    }

    return false;
  };

  // ルートフォルダをフィルタリング
  const filteredFolders = folders.filter((folder) => filterAndBuildMap(folder));

  return { filteredFolders, filteredChildMap };
}

/**
 * パンくずリスト用のフォルダパスを構築
 *
 * @description
 * 指定されたフォルダIDから親を辿り、ルートまでのパスを配列で返します。
 * 配列の順序はルートから現在のフォルダまでの順です。
 *
 * @param folders 全フォルダの配列
 * @param currentFolderId 現在のフォルダID
 * @returns ルートから現在フォルダまでのパス配列
 */
export function buildBreadcrumbs(
  folders: Folder[],
  currentFolderId: number | null
): Folder[] {
  if (!currentFolderId) return [];

  const breadcrumbs: Folder[] = [];
  const folderMap = new Map(folders.map((f) => [f.id, f]));

  let currentId: number | null = currentFolderId;
  const visited = new Set<number>(); // 循環参照対策

  // 親を辿ってルートまで遡る
  while (currentId !== null && !visited.has(currentId)) {
    visited.add(currentId);
    const folder = folderMap.get(currentId);

    if (!folder) break;

    breadcrumbs.unshift(folder); // 配列の先頭に追加（逆順）
    currentId = folder.parent_id;
  }

  return breadcrumbs;
}
