/**
 * カスタムフック集
 * コンポーネント間で共通のロジックを再利用するためのフック
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  Folder,
  Tag,
  Grade,
  Subject,
  TestWithTags,
  TestAttachment,
} from "@/types/database";

/**
 * API呼び出しの基本型
 */
interface ApiResponse<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * フォルダ一覧を取得するフック
 * @returns フォルダ一覧と読み込み状態
 */
export function useFolders(): ApiResponse<Folder[]> {
  const [data, setData] = useState<Folder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // フォルダ取得処理（useCallbackでメモ化）
  const fetchFolders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/folders");
      if (!response.ok) {
        throw new Error("フォルダの取得に失敗しました");
      }
      const folders = await response.json();
      setData(folders);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      console.error("フォルダ取得エラー:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初回マウント時に実行
  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  return { data, loading, error, refetch: fetchFolders };
}

/**
 * カテゴリ（学年と科目）を取得するフック
 * @param refreshTrigger 再取得トリガー
 * @returns カテゴリ一覧と読み込み状態
 */
export function useCategories(
  refreshTrigger?: number
): ApiResponse<Array<{ grade: string; subjects: string[] }>> {
  const [data, setData] = useState<Array<{
    grade: string;
    subjects: string[];
  }> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // カテゴリ取得処理（useCallbackでメモ化）
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/categories");
      if (!response.ok) {
        throw new Error("カテゴリの取得に失敗しました");
      }
      const categories = await response.json();
      setData(categories);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      console.error("カテゴリ取得エラー:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初回マウント時と refreshTrigger 変更時に実行
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories, refreshTrigger]);

  return { data, loading, error, refetch: fetchCategories };
}

/**
 * タグ一覧を取得するフック
 * @returns タグ一覧と読み込み状態
 */
export function useTags(): ApiResponse<Tag[]> {
  const [data, setData] = useState<Tag[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // タグ取得処理（useCallbackでメモ化）
  const fetchTags = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/tags");
      if (!response.ok) {
        throw new Error("タグの取得に失敗しました");
      }
      const tags = await response.json();
      setData(tags);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      console.error("タグ取得エラー:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初回マウント時に実行
  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  return { data, loading, error, refetch: fetchTags };
}

/**
 * 学年一覧を取得するフック
 * @returns 学年一覧と読み込み状態
 */
export function useGrades(): ApiResponse<Grade[]> {
  const [data, setData] = useState<Grade[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 学年取得処理（useCallbackでメモ化）
  const fetchGrades = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/grades");
      if (!response.ok) {
        throw new Error("学年の取得に失敗しました");
      }
      const grades = await response.json();
      setData(grades);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      console.error("学年取得エラー:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初回マウント時に実行
  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  return { data, loading, error, refetch: fetchGrades };
}

/**
 * 科目一覧を取得するフック
 * @returns 科目一覧と読み込み状態
 */
export function useSubjects(): ApiResponse<Subject[]> {
  const [data, setData] = useState<Subject[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 科目取得処理（useCallbackでメモ化）
  const fetchSubjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/subjects");
      if (!response.ok) {
        throw new Error("科目の取得に失敗しました");
      }
      const subjects = await response.json();
      setData(subjects);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      console.error("科目取得エラー:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初回マウント時に実行
  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  return { data, loading, error, refetch: fetchSubjects };
}

/**
 * テスト一覧取得のパラメータ型
 */
interface TestFilters {
  folderId?: number | null;
  grade?: string | null;
  subject?: string | null;
  tagId?: number | null;
  search?: string;
}

/**
 * テスト一覧を取得するフック（フィルター対応）
 * @param filters フィルター条件
 * @returns テスト一覧と読み込み状態
 */
export function useTests(filters: TestFilters): ApiResponse<TestWithTags[]> {
  const [data, setData] = useState<TestWithTags[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // URLパラメータを構築（useMemoでメモ化）
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.folderId)
      params.append("folderId", filters.folderId.toString());
    if (filters.grade) params.append("grade", filters.grade);
    if (filters.subject) params.append("subject", filters.subject);
    if (filters.tagId) params.append("tagId", filters.tagId.toString());
    if (filters.search) params.append("search", filters.search);
    return params.toString();
  }, [
    filters.folderId,
    filters.grade,
    filters.subject,
    filters.tagId,
    filters.search,
  ]);

  // テスト取得処理（useCallbackでメモ化）
  const fetchTests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = `/api/tests${queryParams ? `?${queryParams}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("テストの取得に失敗しました");
      }
      const tests = await response.json();
      setData(tests);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      console.error("テスト取得エラー:", err);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  // queryParams 変更時に実行（デバウンス処理は呼び出し側で実装）
  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  return { data, loading, error, refetch: fetchTests };
}

/**
 * テストの添付ファイルを取得するフック
 * @param testId テストID
 * @returns 添付ファイル一覧と読み込み状態
 */
export function useTestAttachments(
  testId: number | null
): ApiResponse<TestAttachment[]> {
  const [data, setData] = useState<TestAttachment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 添付ファイル取得処理（useCallbackでメモ化）
  const fetchAttachments = useCallback(async () => {
    if (!testId) {
      setData(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/tests/${testId}/attachments`);
      if (!response.ok) {
        throw new Error("添付ファイルの取得に失敗しました");
      }
      const result = await response.json();
      setData(result.attachments || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      console.error("添付ファイル取得エラー:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [testId]);

  // testId 変更時に実行
  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  return { data, loading, error, refetch: fetchAttachments };
}

/**
 * デバウンス処理を行うフック
 * @param value デバウンスする値
 * @param delay 遅延時間（ミリ秒）
 * @returns デバウンスされた値
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // 指定時間後に値を更新
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // クリーンアップ関数でタイマーをクリア
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * ローカルストレージに状態を保存するフック
 * Set型の値をシリアライズして保存
 * @param key ストレージキー
 * @param initialValue 初期値
 * @returns [値, 更新関数]
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // 初期値を取得（ローカルストレージから取得または初期値を使用）
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      if (!item) return initialValue;

      const parsed = JSON.parse(item);
      // Set型の復元
      if (initialValue instanceof Set) {
        return new Set(parsed) as T;
      }
      return parsed;
    } catch (error) {
      console.error("ローカルストレージ読み込みエラー:", error);
      return initialValue;
    }
  });

  // 値を更新する関数（useCallbackでメモ化）
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        // 関数が渡された場合は現在の値を渡して実行
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);

        if (typeof window !== "undefined") {
          // Set型の場合は配列に変換して保存
          const toSave =
            valueToStore instanceof Set
              ? Array.from(valueToStore)
              : valueToStore;
          window.localStorage.setItem(key, JSON.stringify(toSave));
        }
      } catch (error) {
        console.error("ローカルストレージ書き込みエラー:", error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue];
}

/**
 * 統計情報サマリーの型定義
 */
export interface StatsSummary {
  overview: {
    totalTests: number;
    totalFolders: number;
    totalTags: number;
    testsWithPdf: number;
    testsWithoutPdf: number;
  };
  testsByGrade: { grade: string; count: number }[];
  testsBySubject: { subject: string; count: number }[];
  topTags: { id: number; name: string; color: string; usage_count: number }[];
  testsByFolder: { id: number; name: string; count: number }[];
  recentTests: {
    id: number;
    name: string;
    subject: string;
    grade: string;
    created_at: string;
    folder_name: string;
  }[];
}

/**
 * 統計情報サマリーを取得するフック
 *
 * @description
 * システム全体の統計情報を取得します:
 * - 総テスト数、フォルダ数、タグ数
 * - 学年別・科目別のテスト数
 * - タグ使用頻度トップ10
 * - フォルダ別テスト数トップ10
 * - 最近追加されたテスト10件
 *
 * @returns 統計情報と読み込み状態
 */
export function useStatsSummary(): ApiResponse<StatsSummary> {
  const [data, setData] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/stats/summary");
      if (!response.ok) {
        throw new Error("統計情報の取得に失敗しました");
      }
      const stats = await response.json();
      setData(stats);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      console.error("統計情報取得エラー:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { data, loading, error, refetch: fetchStats };
}
