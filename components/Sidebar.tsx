"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import type { Folder } from "@/types/database";
import {
  useFolders,
  useCategories,
  useLocalStorage,
  useDebounce,
} from "@/lib/hooks";
import { buildFolderTree, moveArrayItem, filterFolderTree } from "@/lib/utils";
import { ThemeTogglePanel } from "./ThemeProvider";

/**
 * サイドバーコンポーネント
 * フォルダ一覧、カテゴリ、管理者メニューを表示し、
 * テスト一覧のフィルタリングを管理する
 */

/** サイドバーのプロパティ定義 */
interface SidebarProps {
  /** フォルダ選択時のコールバック */
  onFolderSelect: (folderId: number | null) => void;
  /** 現在選択されているフォルダID */
  selectedFolderId: number | null;
  /** カテゴリ（学年・科目）選択時のコールバック */
  onCategorySelect: (grade: string | null, subject: string | null) => void;
  /** 現在選択されているカテゴリ */
  selectedCategory: { grade: string | null; subject: string | null } | null;
  /** 管理者メニュークリック時のコールバック */
  onAdminMenuClick: () => void;
  /** カテゴリ再取得のトリガー（値が変わるたびに再取得） */
  refreshTrigger?: number;
}

/** カテゴリの型定義 */
interface Category {
  grade: string;
  subjects: string[];
}

export default function Sidebar({
  onFolderSelect,
  selectedFolderId,
  onCategorySelect,
  selectedCategory,
  onAdminMenuClick,
  refreshTrigger,
}: SidebarProps) {
  // カスタムフックを使用してフォルダとカテゴリを取得（件数付き）
  const {
    data: foldersData,
    loading: foldersLoading,
    refetch: refetchFolders,
  } = useFolders(true);
  const { data: categoriesData } = useCategories(refreshTrigger);

  /**
   * ローカルストレージに展開状態を保存（ページリロード後も保持）
   *
   * @description
   * - useLocalStorageカスタムフックでSet型の状態を永続化
   * - expandedFolders: 展開中のフォルダIDをSet<number>で管理
   * - expandedGrades: 展開中の学年名をSet<string>で管理
   * - ページリロード後もユーザーの展開状態が復元される
   * - Set型を使用することで重複なく高速な検索・追加・削除が可能
   */
  const [expandedFolders, setExpandedFolders] = useLocalStorage<Set<number>>(
    "sidebar-expanded-folders",
    new Set()
  );
  const [expandedGrades, setExpandedGrades] = useLocalStorage<Set<string>>(
    "sidebar-expanded-grades",
    new Set()
  );

  // ドラッグ&ドロップ用の状態
  const [draggedFolderId, setDraggedFolderId] = useState<number | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);

  // フォルダツリーのフィルタリング用の状態
  const [folderSearchQuery, setFolderSearchQuery] = useState<string>("");
  const debouncedFolderQuery = useDebounce(folderSearchQuery, 300);

  // 表示設定パネルの開閉
  const [themeOpen, setThemeOpen] = useState(false);

  // #78 受信トレイ未処理バッジ
  const [inboxPendingCount, setInboxPendingCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/inbox");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setInboxPendingCount(data.pendingCount ?? 0);
      } catch { /* サイレントに失敗 */ }
    };
    fetchCount();
    // 5分ごとに再取得
    const interval = setInterval(fetchCount, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // データをstateとして扱う（nullチェック対応）
  const folders = foldersData || [];
  const categories = categoriesData || [];

  /**
   * フォルダの展開/折りたたみ状態を切り替え
   *
   * @description
   * - ユーザーがフォルダの展開ボタンをクリックした際に呼ばれる
   * - 展開状態はSet<number>で管理し、useLocalStorageで永続化
   * - 既に展開中のフォルダをクリックした場合はSetから削除(折りたたみ)
   * - 折りたたまれているフォルダをクリックした場合はSetに追加(展開)
   *
   * @param {number} folderId - 展開/折りたたみを切り替えるフォルダのID
   */
  const toggleFolder = (folderId: number) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  /**
   * 学年の展開/折りたたみ状態を切り替え
   *
   * @description
   * - 学年セクション(「高校1年生」等)の展開ボタンをクリックした際に呼ばれる
   * - 展開状態はSet<string>で管理し、useLocalStorageで永続化
   * - 既に展開中の学年をクリックした場合はSetから削除(折りたたみ)
   * - 折りたたまれている学年をクリックした場合はSetに追加(展開)
   * - 学年配下の科目リストの表示/非表示を制御
   *
   * @param {string} grade - 展開/折りたたみを切り替える学年名
   */
  const toggleGrade = (grade: string) => {
    const newExpanded = new Set(expandedGrades);
    if (newExpanded.has(grade)) {
      newExpanded.delete(grade);
    } else {
      newExpanded.add(grade);
    }
    setExpandedGrades(newExpanded);
  };

  /**
   * フォルダのドラッグ開始ハンドラー
   *
   * @description
   * - ドラッグ操作を開始し、ドラッグ中のフォルダIDを保存
   * - 「すべてのテスト」(id=1)と「未分類」(id=2)は固定フォルダのためドラッグ不可
   * - effectAllowedを'move'に設定して移動操作であることを明示
   *
   * @param {React.DragEvent} e - ドラッグイベント
   * @param {number} folderId - ドラッグ開始したフォルダのID
   */
  const handleDragStart = (e: React.DragEvent, folderId: number) => {
    // 「すべてのテスト」と「未分類」はドラッグ不可
    if (folderId === 1 || folderId === 2) {
      e.preventDefault();
      return;
    }
    setDraggedFolderId(folderId);
    e.dataTransfer.effectAllowed = "move";
  };

  /**
   * フォルダ上をドラッグ中のハンドラー
   *
   * @description
   * - ドラッグカーソルが他のフォルダ上を通過中の処理
   * - e.preventDefault()でデフォルトの挙動(ドロップ不可)をキャンセル
   * - dropEffectを'move'に設定してドロップ可能であることを視覚的に表現
   * - ドラッグオーバー中のフォルダIDを保存し、ハイライト表示に使用
   *
   * @param {React.DragEvent} e - ドラッグイベント
   * @param {number} folderId - ドラッグカーソルが通過中のフォルダID
   */
  const handleDragOver = (e: React.DragEvent, folderId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverFolderId(folderId);
  };

  // ドラッグリーブ
  const handleDragLeave = () => {
    setDragOverFolderId(null);
  };

  /**
   * フォルダのドロップハンドラー(フォルダ順序変更の実行)
   *
   * @description
   * ドラッグ&ドロップによるフォルダ並び順の変更処理:
   * 1. バリデーション: ドラッグ中のフォルダと同じ位置にドロップした場合は処理中断
   * 2. 配列操作: splice()を使用してフォルダ配列内の順序を入れ替え
   * 3. API通信: PUT /api/foldersでサーバーに新しい順序を保存
   * 4. データ再取得: refetchFolders()で最新データをサーバーから取得
   * 5. エラー処理: 失敗時もrefetch()でサーバー状態に合わせる(楽観的更新のロールバック)
   *
   * @param {React.DragEvent} e - ドロップイベント
   * @param {number} targetFolderId - ドロップ先のフォルダID
   */
  const handleDrop = async (e: React.DragEvent, targetFolderId: number) => {
    e.preventDefault();

    // バリデーション: ドラッグ中のフォルダと同じ位置にドロップした場合は処理中断
    if (!draggedFolderId || draggedFolderId === targetFolderId) {
      setDraggedFolderId(null);
      setDragOverFolderId(null);
      return;
    }

    // フォルダの順序を入れ替え(配列操作)
    const newFolders = [...folders];
    const draggedIndex = newFolders.findIndex((f) => f.id === draggedFolderId);
    const targetIndex = newFolders.findIndex((f) => f.id === targetFolderId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // 配列内で要素を移動: splice()で削除した要素を別の位置に挿入
    const [removed] = newFolders.splice(draggedIndex, 1);
    newFolders.splice(targetIndex, 0, removed);

    // ドラッグ状態をクリア
    setDraggedFolderId(null);
    setDragOverFolderId(null);

    // サーバーに順序を保存(APIリクエスト)
    try {
      const folderIds = newFolders.map((f) => f.id);
      const response = await fetch("/api/folders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderIds }),
      });

      if (!response.ok) {
        throw new Error("順序の更新に失敗しました");
      }

      // 成功したらデータを再取得(サーバー状態と同期)
      await refetchFolders();
    } catch (error) {
      console.error("フォルダ順序更新エラー:", error);
      // エラー時も再取得してサーバー状態に戻す(楽観的更新のロールバック)
      await refetchFolders();
    }
  };

  // ドラッグ終了
  const handleDragEnd = () => {
    setDraggedFolderId(null);
    setDragOverFolderId(null);
  };

  /**
   * フォルダの階層構造を構築してフィルタリング(useMemoでメモ化)
   *
   * @description
   * - buildFolderTree()を使用してフラットなフォルダ配列を階層構造に変換
   * - filterFolderTree()で検索クエリに基づいてツリーをフィルタリング
   * - rootFolders: 親フォルダを持たないトップレベルのフォルダ配列
   * - childMap: 各フォルダID(親)をキーとして、その子フォルダ配列を保持するMap
   * - useMemoで計算結果をキャッシュし、foldersまたはdebouncedFolderQueryが変更された時のみ再計算
   * - これにより不要な再レンダリングを防ぎ、パフォーマンスを最適化
   */
  const { rootFolders, childMap } = useMemo(() => {
    const tree = buildFolderTree(folders);

    // 検索クエリがある場合はフィルタリング
    if (debouncedFolderQuery.trim()) {
      const { filteredFolders, filteredChildMap } = filterFolderTree(
        tree.rootFolders,
        tree.childMap,
        debouncedFolderQuery
      );
      return { rootFolders: filteredFolders, childMap: filteredChildMap };
    }

    return tree;
  }, [folders, debouncedFolderQuery]);

  /**
   * フォルダアイテムを再帰的にレンダリング
   *
   * @description
   * 階層構造のフォルダツリーを描画する再帰関数:
   * - 各フォルダのレンダリング(展開ボタン、アイコン、名前、ドラッグハンドル)
   * - 子フォルダがある場合は再帰的に renderFolder() を呼び出し
   * - インデント(level)によって階層の深さを視覚的に表現
   * - ドラッグ&ドロップ状態に応じたスタイル適用(isDragging, isDragOver)
   *
   * @param {Folder} folder - レンダリングするフォルダオブジェクト
   * @param {number} level - 階層の深さ(0=ルート、1=第1階層、2=第2階層...)
   * @param {Map<number, Folder[]>} childMap - 親IDをキーとする子フォルダのMap
   * @returns {JSX.Element} フォルダツリーのJSX要素
   */
  const renderFolder = (
    folder: Folder,
    level: number = 0,
    childMap: Map<number, Folder[]>
  ) => {
    const hasChildren = childMap.has(folder.id);
    const isExpanded = expandedFolders.has(folder.id);
    const children = childMap.get(folder.id) || [];
    const isDragging = draggedFolderId === folder.id;
    const isDragOver = dragOverFolderId === folder.id;
    const isDraggable = folder.id !== 1 && folder.id !== 2; // 「すべてのテスト」と「未分類」以外はドラッグ可能

    return (
      <div key={folder.id}>
        <div
          className={`flex items-center ${isDragging ? "opacity-50" : ""} ${
            isDragOver ? "bg-blue-700" : ""
          }`}
          draggable={isDraggable}
          onDragStart={(e) => handleDragStart(e, folder.id)}
          onDragOver={(e) => handleDragOver(e, folder.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, folder.id)}
          onDragEnd={handleDragEnd}
        >
          {/* ドラッグハンドル */}
          {isDraggable && (
            <div className="p-1 cursor-move text-gray-400 hover:text-white">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"></path>
              </svg>
            </div>
          )}
          {!isDraggable && <div className="w-5"></div>}

          {/* 展開/折りたたみボタン */}
          {hasChildren && (
            <button
              onClick={() => toggleFolder(folder.id)}
              className="p-1 hover:bg-blue-600 rounded"
            >
              <svg
                className={`w-4 h-4 transition-transform ${
                  isExpanded ? "rotate-90" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          )}

          {/* フォルダボタン */}
          <button
            onClick={() => {
              console.log("Folder clicked:", folder.id, folder.name);
              onFolderSelect(folder.id);
            }}
            className={`flex-1 text-left px-1.5 md:px-2 py-1 md:py-1.5 rounded transition-colors flex items-center gap-1.5 md:gap-2 text-xs md:text-sm ${
              !hasChildren ? "ml-5" : ""
            } ${
              (folder.id === 1 &&
                selectedFolderId === null &&
                !selectedCategory?.grade) ||
              (folder.id !== 1 && selectedFolderId === folder.id)
                ? "bg-sidebar-dark"
                : "hover:bg-blue-600"
            }`}
            style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
          >
            <svg
              className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <span className="break-words flex-1">{folder.name}</span>
            {typeof folder.test_count === "number" && folder.test_count > 0 && (
              <span className="ml-1 flex-shrink-0 text-xs text-blue-200 bg-blue-800 bg-opacity-50 rounded-full px-1.5 py-0.5 leading-none">
                {folder.test_count}
              </span>
            )}
          </button>
        </div>

        {/* 子フォルダ */}
        {hasChildren && isExpanded && (
          <div>
            {children.map((child) => renderFolder(child, level + 1, childMap))}
          </div>
        )}
      </div>
    );
  };

  // JSXレンダリング
  return (
    <div className="w-full md:w-56 bg-sidebar text-white h-screen flex flex-col overflow-hidden">
      {/* ヘッダー */}
      <div className="p-2 md:p-2.5 border-b border-sidebar-dark flex-shrink-0">
        <div className="flex items-center gap-1.5 md:gap-2">
          <img
            src="/logo.png"
            alt="ロゴ"
            className="w-6 h-6 md:w-7 md:h-7 object-contain flex-shrink-0"
            onError={(e) => {
              // 画像読み込みエラー時は非表示
              e.currentTarget.style.display = "none";
            }}
          />
          <h1 className="text-sm md:text-base font-bold break-words flex-1">
            テスト管理システム
          </h1>
        </div>
      </div>

      {/* ダッシュボードボタン */}
      <div className="px-2 md:px-2.5 py-1.5 md:py-2 border-b border-sidebar-dark">
        <a
          href="/dashboard"
          className="w-full flex items-center gap-2 md:gap-2.5 px-2 md:px-3 py-2 md:py-2.5 rounded-lg hover:bg-blue-600 transition-colors text-white bg-blue-500 shadow-sm"
        >
          <svg
            className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <span className="text-sm md:text-base font-semibold">
            ダッシュボード
          </span>
        </a>
        {/* 受信トレイボタン */}
        <a
          href="/inbox"
          className="mt-1.5 w-full flex items-center gap-2 md:gap-2.5 px-2 md:px-3 py-2 md:py-2.5 rounded-lg hover:bg-gray-600 transition-colors text-white bg-gray-500 shadow-sm"
        >
          <svg
            className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <span className="text-sm md:text-base font-semibold flex-1">
            メール受信トレイ
          </span>
          {/* #78 未処理バッジ */}
          {inboxPendingCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
              {inboxPendingCount > 99 ? "99+" : inboxPendingCount}
            </span>
          )}
        </a>
      </div>

      {/* フォルダ一覧 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-1">
          <div className="flex items-center justify-between px-1.5 md:px-2 py-1 md:py-1.5">
            <h2 className="text-xs md:text-sm font-semibold text-blue-100">
              フォルダ一覧
            </h2>
          </div>

          {/* フォルダ検索ボックス */}
          <div className="px-1.5 md:px-2 mb-1.5 md:mb-2">
            <input
              type="search"
              placeholder="フォルダを検索..."
              value={folderSearchQuery}
              onChange={(e) => setFolderSearchQuery(e.target.value)}
              className="w-full px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm bg-sidebar-dark text-white rounded border border-gray-600 focus:border-blue-400 focus:outline-none placeholder-gray-400"
            />
          </div>

          {foldersLoading ? (
            <div className="px-2 py-1.5 text-sm">読み込み中...</div>
          ) : rootFolders.length === 0 && debouncedFolderQuery.trim() ? (
            <div className="px-2 py-1.5 text-sm text-gray-400">
              「{debouncedFolderQuery}」に一致するフォルダが見つかりません
            </div>
          ) : (
            <div className="space-y-0.5">
              {rootFolders.map((folder) => renderFolder(folder, 0, childMap))}
            </div>
          )}
        </div>

        {/* カテゴリ一覧 */}
        <div className="p-1 border-t border-sidebar-dark mt-1">
          <h2 className="text-xs md:text-sm font-semibold px-1.5 md:px-2 py-1 md:py-1.5 text-blue-100">
            カテゴリ
          </h2>
          <div className="space-y-0.5">
            {categories.map((category) => {
              const isGradeExpanded = expandedGrades.has(category.grade);
              const hasSubjects = category.subjects.length > 0;

              return (
                <div key={category.grade}>
                  <div className="flex items-center">
                    {/* 展開/折りたたみボタン */}
                    {hasSubjects && (
                      <button
                        onClick={() => toggleGrade(category.grade)}
                        className="p-2 hover:bg-blue-600 rounded transition-colors"
                      >
                        <svg
                          className={`w-4 h-4 transition-transform ${
                            isGradeExpanded ? "rotate-90" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>
                    )}

                    {/* 学年ボタン */}
                    <button
                      onClick={() => {
                        onCategorySelect(category.grade, null);
                      }}
                      className={`flex-1 text-left px-1.5 md:px-2 py-1 md:py-1.5 rounded transition-colors flex items-center gap-1.5 md:gap-2 text-xs md:text-sm ${
                        !hasSubjects ? "ml-5" : ""
                      } ${
                        selectedCategory?.grade === category.grade &&
                        !selectedCategory?.subject
                          ? "bg-sidebar-dark"
                          : "hover:bg-blue-600"
                      }`}
                    >
                      <svg
                        className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                      </svg>
                      <span className="break-words">{category.grade}</span>
                    </button>
                  </div>

                  {/* 科目一覧 */}
                  {hasSubjects && isGradeExpanded && (
                    <div className="ml-5">
                      {category.subjects.map((subject) => (
                        <button
                          key={subject}
                          onClick={() => {
                            onCategorySelect(category.grade, subject);
                          }}
                          className={`w-full text-left px-1.5 md:px-2 py-1 md:py-1.5 rounded transition-colors flex items-center gap-1.5 md:gap-2 ml-5 text-xs md:text-sm ${
                            selectedCategory?.grade === category.grade &&
                            selectedCategory?.subject === subject
                              ? "bg-sidebar-dark"
                              : "hover:bg-blue-600"
                          }`}
                        >
                          <svg
                            className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <span className="break-words">{subject}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 表示設定 */}
      <div className="border-t border-sidebar-dark flex-shrink-0">
        <button
          onClick={() => setThemeOpen((v) => !v)}
          className="w-full text-left px-2 md:px-3 py-1.5 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm hover:bg-blue-600 transition-colors"
        >
          <svg className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
          <span>表示設定</span>
          <svg className={`w-3 h-3 ml-auto transition-transform ${themeOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {themeOpen && (
          <div className="px-2 pb-2">
            <ThemeTogglePanel />
          </div>
        )}
      </div>

      {/* 管理者メニュー */}
      <div className="p-1.5 md:p-2 border-t border-sidebar-dark flex-shrink-0">
        <button
          onClick={onAdminMenuClick}
          className="w-full text-left px-1.5 md:px-2 py-1 md:py-1.5 rounded hover:bg-blue-600 transition-colors flex items-center gap-1.5 md:gap-2 text-xs md:text-sm"
        >
          <svg
            className="w-4 h-4 md:w-5 md:h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span>管理者メニュー</span>
        </button>
      </div>
    </div>
  );
}
