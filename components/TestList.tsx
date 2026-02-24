"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Sidebar from "./Sidebar";
import PdfViewer from "./PdfViewer";
import AdminModal from "./AdminModal";
import type { TestWithTags, TestAttachment, Tag } from "@/types/database";
import { useFolders, useLocalStorage } from "@/lib/hooks";
import { buildBreadcrumbs } from "@/lib/utils";
import { useToast } from "./ToastProvider";

/**
 * テスト一覧コンポーネント
 * メイン画面のレイアウトとテスト一覧の表示
 */

/** 検索キーワードをテキスト内でハイライト表示するヘルパー */
function highlightText(text: string | null | undefined, query: string): React.ReactNode {
  if (!text) return text ?? "";
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">{part}</mark>
    ) : (
      part
    )
  );
}
export default function TestList() {
  const [tests, setTests] = useState<TestWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<{
    grade: string | null;
    subject: string | null;
  } | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<TestWithTags | null>(null);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [testAttachments, setTestAttachments] = useState<TestAttachment[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [categoryRefreshTrigger, setCategoryRefreshTrigger] = useState(0);

  // 表示設定（localStorageに永続化・デバイスごとに独立）
  const [sortOrder, setSortOrder] = useLocalStorage<"newest" | "oldest" | "name">(
    "testlist-sort",
    "newest"
  );
  const [viewMode, setViewMode] = useLocalStorage<"list" | "card">(
    "testlist-view-mode",
    "list"
  );
  const [rowHeight, setRowHeight] = useLocalStorage<"compact" | "standard" | "wide">(
    "testlist-row-height",
    "standard"
  );
  const [perPage, setPerPage] = useLocalStorage<number>(
    "testlist-per-page",
    25
  );
  // ページ番号はセッション内のみ（リロードでリセット）
  const [currentPage, setCurrentPage] = useState(0);

  const { error: toastError, success: toastSuccess } = useToast();

  // 複数選択・一括操作
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"none" | "move" | "grade" | "subject" | "tag">("none");
  const [bulkTargetFolderId, setBulkTargetFolderId] = useState<string>("");
  const [bulkTargetGrade, setBulkTargetGrade] = useState("");
  const [bulkTargetSubject, setBulkTargetSubject] = useState("");
  const [bulkTargetTagId, setBulkTargetTagId] = useState<string>("");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // フォルダデータを取得してパンくずリスト用に使用
  const { data: foldersData } = useFolders();
  const folders = foldersData || [];

  // パンくずリストを構築（useMemoでメモ化）
  const breadcrumbs = useMemo(() => {
    if (!selectedFolderId) return [];
    return buildBreadcrumbs(folders, selectedFolderId);
  }, [folders, selectedFolderId]);

  // 表示設定に基づきソート済みテスト一覧を生成
  const sortedTests = useMemo(() => {
    return [...tests].sort((a, b) => {
      if (sortOrder === "name") return a.name.localeCompare(b.name, "ja");
      if (sortOrder === "oldest")
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      // "newest" (default)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [tests, sortOrder]);

  // ページネーション: ソート・フィルタ変更時にページリセット
  useEffect(() => {
    setCurrentPage(0);
  }, [sortedTests.length, perPage]);

  // ページネーション済みデータ
  const totalPages = perPage === 0 ? 1 : Math.ceil(sortedTests.length / perPage);
  const paginatedTests = useMemo(() => {
    if (perPage === 0) return sortedTests;
    const start = currentPage * perPage;
    return sortedTests.slice(start, start + perPage);
  }, [sortedTests, currentPage, perPage]);

  // 行高さCSSクラス
  const rowPadding: Record<string, string> = {
    compact: "py-1",
    standard: "py-3",
    wide: "py-5",
  };

  const fetchTests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      console.log("Fetching tests with:", {
        selectedFolderId,
        selectedCategory,
        selectedTagId,
        searchQuery,
      });

      if (selectedFolderId)
        params.append("folderId", selectedFolderId.toString());
      if (selectedCategory?.grade)
        params.append("grade", selectedCategory.grade);
      if (selectedCategory?.subject)
        params.append("subject", selectedCategory.subject);
      if (selectedTagId) params.append("tagId", selectedTagId.toString());
      if (searchQuery) params.append("search", searchQuery);

      console.log("API URL:", `/api/tests?${params.toString()}`);

      const response = await fetch(`/api/tests?${params}`);
      if (!response.ok) throw new Error("テストの取得に失敗しました");
      const data = await response.json();
      setTests(data);
    } catch (error) {
      console.error("テスト取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  // タグ一覧の取得
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch("/api/tags");
        if (!response.ok) throw new Error("タグの取得に失敗しました");
        const data = await response.json();
        setTags(data);
      } catch (error) {
        console.error("タグ取得エラー:", error);
      }
    };
    fetchTags();
  }, []);

  // テスト一覧の取得(フォルダ、カテゴリ、タグ、検索の変更時)
  useEffect(() => {
    // 検索のみデバウンス処理
    if (searchQuery) {
      const timer = setTimeout(() => {
        fetchTests();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      // 検索以外は即座に実行
      fetchTests();
    }
  }, [selectedFolderId, selectedCategory, selectedTagId, searchQuery]);

  /**
   * CSVエクスポート処理
   * 現在のフィルタ条件でテストデータをCSV形式でダウンロード
   */
  const handleExportCSV = () => {
    const params = new URLSearchParams();

    // 現在のフィルタ条件をクエリパラメータに追加
    if (selectedFolderId)
      params.append("folderId", selectedFolderId.toString());
    if (selectedCategory?.grade) params.append("grade", selectedCategory.grade);
    if (selectedCategory?.subject)
      params.append("subject", selectedCategory.subject);
    if (selectedTagId) params.append("tagId", selectedTagId.toString());
    if (searchQuery) params.append("search", searchQuery);

    // エクスポートAPIにリダイレクトしてダウンロード
    const exportUrl = `/api/export/tests?${params.toString()}`;
    window.location.href = exportUrl;
  };

  // 日付フォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  // テスト削除処理
  const handleDelete = async (testId: number) => {
    if (!deleteConfirm || deleteConfirm !== testId) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/tests/${testId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "削除に失敗しました");
      }

      // 成功したら一覧を再取得
      await fetchTests();
      setDeleteConfirm(null);
      // カテゴリを再取得
      setCategoryRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("削除エラー:", error);
      toastError("テストの削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  };

  // PDFプレビュー表示
  const handleViewPdf = async (test: TestWithTags) => {
    setSelectedTest(test);
    setSelectedPdfUrl(test.pdf_path);

    // 添付ファイルを取得
    try {
      const response = await fetch(`/api/tests/${test.id}/attachments`);
      if (response.ok) {
        const data = await response.json();
        setTestAttachments(data.attachments || []);
      }
    } catch (error) {
      console.error("添付ファイル取得エラー:", error);
      setTestAttachments([]);
    }

    setPdfViewerOpen(true);
  };

  // PDFプレビュー閉じる
  const handleClosePdfViewer = () => {
    setPdfViewerOpen(false);
    setSelectedPdfUrl(null);
    setSelectedTest(null);
    setTestAttachments([]);
  };

  // 複数選択ヘルパー
  const toggleSelectId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedTests.length && paginatedTests.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedTests.map((t) => t.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkAction("none");
  };

  // 一括削除
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    try {
      const res = await fetch("/api/tests/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("削除に失敗しました");
      const data = await res.json();
      toastSuccess(`${data.count}件のテストを削除しました`);
      clearSelection();
      await fetchTests();
      setCategoryRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      toastError("一括削除に失敗しました");
    } finally {
      setBulkProcessing(false);
    }
  };

  // 一括更新（フォルダ移動・学年/科目変更・タグ追加）
  const handleBulkUpdate = async (payload: Record<string, unknown>) => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    try {
      const res = await fetch("/api/tests/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), ...payload }),
      });
      if (!res.ok) throw new Error("更新に失敗しました");
      const data = await res.json();
      toastSuccess(`${data.count}件のテストを更新しました`);
      clearSelection();
      await fetchTests();
      setCategoryRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      toastError("一括更新に失敗しました");
    } finally {
      setBulkProcessing(false);
      setBulkAction("none");
    }
  };

  // PDF一括ZIPダウンロード (#106)
  const handleBulkZipDownload = async () => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    try {
      const res = await fetch("/api/export/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testIds: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "ZIPダウンロードに失敗しました");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tests_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toastSuccess(`${selectedIds.size}件のPDFをZIPでダウンロードしました`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "ZIPダウンロードに失敗しました");
    } finally {
      setBulkProcessing(false);
    }
  };

  // テスト複製
  const handleCloneTest = async (testId: number) => {
    try {
      const res = await fetch(`/api/tests/${testId}/clone`, { method: "POST" });
      if (!res.ok) throw new Error("複製に失敗しました");
      toastSuccess("テストを複製しました");
      await fetchTests();
    } catch {
      toastError("テストの複製に失敗しました");
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* モバイル用オーバーレイ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* サイドバー */}
      <div
        className={`
        fixed md:static inset-y-0 left-0 z-50
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0
      `}
      >
        <Sidebar
          onFolderSelect={(folderId) => {
            // 「すべてのテスト」(ID=1)の場合はフィルタをクリア
            setSelectedFolderId(folderId === 1 ? null : folderId);
            setSelectedCategory(null); // カテゴリ選択をクリア
            setSidebarOpen(false); // フォルダ選択後にサイドバーを閉じる
          }}
          selectedFolderId={selectedFolderId}
          onCategorySelect={(grade, subject) => {
            setSelectedCategory({ grade, subject });
            setSelectedFolderId(null); // フォルダ選択をクリア
            setSidebarOpen(false); // カテゴリ選択後にサイドバーを閉じる
          }}
          selectedCategory={selectedCategory}
          onAdminMenuClick={() => {
            setAdminModalOpen(true);
            setSidebarOpen(false); // モバイルでサイドバーを閉じる
          }}
          refreshTrigger={categoryRefreshTrigger}
        />
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
        {/* パンくずリスト */}
        {breadcrumbs.length > 0 && (
          <div className="bg-gray-50 border-b px-4 md:px-6 py-2">
            <nav className="flex items-center gap-2 text-sm overflow-x-auto">
              <button
                onClick={() => setSelectedFolderId(null)}
                className="text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
              >
                ホーム
              </button>
              {breadcrumbs.map((folder, index) => (
                <div key={folder.id} className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-gray-400"
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
                  {index === breadcrumbs.length - 1 ? (
                    <span className="text-gray-700 font-medium whitespace-nowrap">
                      {folder.name}
                    </span>
                  ) : (
                    <button
                      onClick={() => setSelectedFolderId(folder.id)}
                      className="text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                    >
                      {folder.name}
                    </button>
                  )}
                </div>
              ))}
            </nav>
          </div>
        )}

        {/* ヘッダー */}
        <div className="bg-white border-b px-4 md:px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* ハンバーガーメニュー + 検索バー */}
            <div className="flex-1 max-w-2xl flex items-center gap-3">
              {/* ハンバーガーメニューボタン(タブレット以下で表示) */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="メニューを開く"
              >
                <svg
                  className="w-6 h-6 text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>

              {/* 検索バー */}
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="キーワード、科目、学年で検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              {/* タグフィルタ */}
              <div className="relative">
                <select
                  value={selectedTagId ?? ""}
                  onChange={(e) =>
                    setSelectedTagId(
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-white"
                >
                  <option value="">すべてのラベル</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
                <svg
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7l3-3 3 3m0 6l-3 3-3-3"
                  />
                </svg>
              </div>
            </div>

            {/* 新規テスト登録ボタン */}
            <Link
              href="/tests/new"
              className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2 justify-center whitespace-nowrap"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span>新規テスト登録</span>
            </Link>
          </div>

          {/* 表示設定バー（ソート・カード/リスト切替・行高さ・件数/ページ・リセット） */}
          <div className="flex items-center gap-2 flex-wrap mt-3 text-sm">
            {/* ソート選択 */}
            <div className="flex items-center gap-1 text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest" | "name")}
                className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
              >
                <option value="newest">新しい順</option>
                <option value="oldest">古い順</option>
                <option value="name">名前順</option>
              </select>
            </div>

            {/* 表示モード切替 */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                title="リスト表示"
                className={`px-3 py-1 flex items-center gap-1 transition-colors ${
                  viewMode === "list"
                    ? "bg-primary text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <span className="hidden sm:inline">リスト</span>
              </button>
              <button
                onClick={() => setViewMode("card")}
                title="カード表示"
                className={`px-3 py-1 flex items-center gap-1 transition-colors border-l border-gray-300 ${
                  viewMode === "card"
                    ? "bg-primary text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span className="hidden sm:inline">カード</span>
              </button>
            </div>

            {/* 行の高さ切替（リスト表示時のみ） */}
            {viewMode === "list" && (
              <div className="flex rounded-lg border border-gray-300 overflow-hidden" title="行の高さ">
                {(["compact", "standard", "wide"] as const).map((h, i) => (
                  <button
                    key={h}
                    onClick={() => setRowHeight(h)}
                    title={{ compact: "コンパクト", standard: "標準", wide: "広め" }[h]}
                    className={`px-2 py-1 transition-colors ${i > 0 ? "border-l border-gray-300" : ""} ${
                      rowHeight === h ? "bg-primary text-white" : "bg-white text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 w-4 justify-center">
                      {h === "compact" && <><div className="h-px bg-current"/><div className="h-px bg-current"/><div className="h-px bg-current"/></>}
                      {h === "standard" && <><div className="h-0.5 bg-current"/><div className="h-0.5 bg-current"/></>}
                      {h === "wide" && <><div className="h-1 bg-current"/></>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* 表示件数選択 */}
            <div className="flex items-center gap-1 text-gray-600">
              <select
                value={perPage}
                onChange={(e) => { setPerPage(Number(e.target.value)); setCurrentPage(0); }}
                className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
              >
                <option value={10}>10件</option>
                <option value={25}>25件</option>
                <option value={50}>50件</option>
                <option value={100}>100件</option>
                <option value={0}>全件</option>
              </select>
            </div>

            {/* 標準表示に戻すボタン（設定変更時のみ表示） */}
            {(sortOrder !== "newest" || viewMode !== "list" || rowHeight !== "standard" || perPage !== 25) && (
              <button
                onClick={() => {
                  setSortOrder("newest");
                  setViewMode("list");
                  setRowHeight("standard");
                  setPerPage(25);
                  setCurrentPage(0);
                }}
                className="flex items-center gap-1 px-3 py-1 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                標準表示に戻す
              </button>
            )}

            {/* 件数表示 */}
            <span className="text-gray-400 ml-auto">
              {sortedTests.length} 件
              {perPage > 0 && sortedTests.length > perPage &&
                ` （${currentPage * perPage + 1}〜${Math.min((currentPage + 1) * perPage, sortedTests.length)}件目）`
              }
            </span>
          </div>
        </div>

        {/* 一括操作バー（選択中のみ表示） */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 md:px-6 py-2 flex items-center gap-3 flex-wrap text-sm">
            <span className="font-medium text-blue-700">
              {selectedIds.size}件選択中
            </span>
            <button
              onClick={clearSelection}
              className="text-blue-500 hover:text-blue-700 text-xs"
            >
              選択解除
            </button>
            <div className="flex items-center gap-2 ml-2 flex-wrap">
              {/* 一括削除 */}
              <button
                onClick={() => {
                  if (confirm(`${selectedIds.size}件のテストを削除しますか？この操作は取り消せません。`)) {
                    handleBulkDelete();
                  }
                }}
                disabled={bulkProcessing}
                className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                一括削除
              </button>

              {/* フォルダ移動 */}
              {bulkAction === "move" ? (
                <div className="flex items-center gap-1">
                  <select
                    value={bulkTargetFolderId}
                    onChange={(e) => setBulkTargetFolderId(e.target.value)}
                    className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  >
                    <option value="">フォルダを選択...</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => { if (bulkTargetFolderId) handleBulkUpdate({ folderId: Number(bulkTargetFolderId) }); }}
                    disabled={!bulkTargetFolderId || bulkProcessing}
                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs disabled:opacity-50 hover:bg-blue-700"
                  >
                    移動
                  </button>
                  <button onClick={() => setBulkAction("none")} className="px-2 py-1 text-gray-500 text-xs hover:text-gray-700">×</button>
                </div>
              ) : (
                <button
                  onClick={() => setBulkAction("move")}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  フォルダ移動
                </button>
              )}

              {/* 学年一括変更 */}
              {bulkAction === "grade" ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={bulkTargetGrade}
                    onChange={(e) => setBulkTargetGrade(e.target.value)}
                    placeholder="学年を入力..."
                    className="border rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => { if (bulkTargetGrade) handleBulkUpdate({ grade: bulkTargetGrade }); }}
                    disabled={!bulkTargetGrade || bulkProcessing}
                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs disabled:opacity-50 hover:bg-blue-700"
                  >
                    変更
                  </button>
                  <button onClick={() => setBulkAction("none")} className="px-2 py-1 text-gray-500 text-xs hover:text-gray-700">×</button>
                </div>
              ) : (
                <button
                  onClick={() => setBulkAction("grade")}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                >
                  学年変更
                </button>
              )}

              {/* 科目一括変更 */}
              {bulkAction === "subject" ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={bulkTargetSubject}
                    onChange={(e) => setBulkTargetSubject(e.target.value)}
                    placeholder="科目を入力..."
                    className="border rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => { if (bulkTargetSubject) handleBulkUpdate({ subject: bulkTargetSubject }); }}
                    disabled={!bulkTargetSubject || bulkProcessing}
                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs disabled:opacity-50 hover:bg-blue-700"
                  >
                    変更
                  </button>
                  <button onClick={() => setBulkAction("none")} className="px-2 py-1 text-gray-500 text-xs hover:text-gray-700">×</button>
                </div>
              ) : (
                <button
                  onClick={() => setBulkAction("subject")}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                >
                  科目変更
                </button>
              )}

              {/* タグ一括付与 */}
              {bulkAction === "tag" ? (
                <div className="flex items-center gap-1">
                  <select
                    value={bulkTargetTagId}
                    onChange={(e) => setBulkTargetTagId(e.target.value)}
                    className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  >
                    <option value="">ラベルを選択...</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => { if (bulkTargetTagId) handleBulkUpdate({ addTagIds: [Number(bulkTargetTagId)] }); }}
                    disabled={!bulkTargetTagId || bulkProcessing}
                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs disabled:opacity-50 hover:bg-blue-700"
                  >
                    付与
                  </button>
                  <button onClick={() => setBulkAction("none")} className="px-2 py-1 text-gray-500 text-xs hover:text-gray-700">×</button>
                </div>
              ) : (
                <button
                  onClick={() => setBulkAction("tag")}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  ラベル付与
                </button>
              )}

              {/* PDF一括ZIPダウンロード (#106) */}
              <button
                onClick={handleBulkZipDownload}
                disabled={bulkProcessing}
                className="flex items-center gap-1 px-3 py-1 bg-green-50 border border-green-300 text-green-700 rounded hover:bg-green-100 transition-colors disabled:opacity-50"
                title="選択したテストのPDFをZIPでダウンロード"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                ZIP DL
              </button>
            </div>
            {bulkProcessing && <span className="text-blue-500 text-xs ml-2">処理中...</span>}
          </div>
        )}

        {/* テスト一覧テーブル */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              /* ローディングスケルトン (#88) */
              <div className="divide-y divide-gray-100">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
                    <div className="w-4 h-4 bg-gray-200 rounded flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-2/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/3" />
                    </div>
                    <div className="h-5 bg-gray-200 rounded w-16 flex-shrink-0" />
                    <div className="h-5 bg-gray-200 rounded w-16 flex-shrink-0" />
                    <div className="h-3 bg-gray-100 rounded w-20 flex-shrink-0" />
                    <div className="flex gap-1 flex-shrink-0">
                      <div className="w-8 h-8 bg-gray-100 rounded" />
                      <div className="w-8 h-8 bg-gray-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : tests.length === 0 ? (
              <div className="p-12 text-center">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {searchQuery || selectedTagId || selectedCategory ? (
                  <>
                    <p className="text-gray-500 font-medium">条件に一致するテストが見つかりませんでした</p>
                    <p className="text-gray-400 text-sm mt-1">検索条件を変更するか、フィルターをクリアしてください</p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-500 font-medium">まだテストが登録されていません</p>
                    <p className="text-gray-400 text-sm mt-1">「新規テスト登録」ボタンからテストを追加しましょう</p>
                    <Link
                      href="/tests/new"
                      className="inline-flex items-center gap-2 mt-4 bg-primary hover:bg-primary-dark text-white px-5 py-2 rounded-lg transition-colors text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      新規テスト登録
                    </Link>
                  </>
                )}
              </div>
            ) : viewMode === "card" ? (
              /* カード表示モード */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                {paginatedTests.map((test) => (
                  <div
                    key={test.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col gap-2"
                  >
                    {/* テスト名 */}
                    <div className="font-medium text-sm">
                      {test.pdf_path ? (
                        <button
                          onClick={() => handleViewPdf(test)}
                          className="text-blue-600 hover:text-blue-800 hover:underline text-left flex items-start gap-2"
                        >
                          <svg
                            className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>{highlightText(test.name, searchQuery)}</span>
                        </button>
                      ) : (
                        <span className="text-gray-800">{highlightText(test.name, searchQuery)}</span>
                      )}
                    </div>

                    {/* 科目・学年 */}
                    <div className="flex gap-2 text-xs text-gray-500">
                      {test.subject && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{highlightText(test.subject, searchQuery)}</span>}
                      {test.grade && <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded">{highlightText(test.grade, searchQuery)}</span>}
                    </div>

                    {/* ラベル */}
                    {test.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {test.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="px-2 py-0.5 text-xs rounded"
                            style={{ backgroundColor: tag.color + "20", color: tag.color }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* メモ */}
                    {test.description && (
                      <p className="text-xs text-gray-500 italic line-clamp-2">{test.description}</p>
                    )}

                    {/* フッター：登録日 + 操作 */}
                    <div className="flex items-center justify-between mt-auto pt-2 border-t">
                      <span className="text-xs text-gray-400">{formatDate(test.created_at)}</span>
                      <div className="flex gap-2">
                        <Link
                          href={`/tests/${test.id}/edit`}
                          className="text-xs text-primary hover:text-primary-dark font-medium"
                        >
                          編集
                        </Link>
                        {deleteConfirm === test.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleDelete(test.id)}
                              disabled={deleting}
                              className="text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                            >
                              {deleting ? "削除中..." : "確定"}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              disabled={deleting}
                              className="text-xs text-gray-600 hover:text-gray-700 font-medium disabled:opacity-50"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(test.id)}
                            className="text-xs text-red-600 hover:text-red-700 font-medium"
                          >
                            削除
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={paginatedTests.length > 0 && selectedIds.size === paginatedTests.length}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                          title="全て選択/解除"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        テスト名
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        科目
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        学年
                      </th>
                      <th className="px-2 md:px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        メモ
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        ラベル
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        登録日
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paginatedTests.map((test) => (
                      <tr
                        key={test.id}
                        className={`hover:bg-gray-50 transition-colors ${selectedIds.has(test.id) ? "bg-blue-50" : ""}`}
                      >
                        <td className={`px-3 ${rowPadding[rowHeight]} w-10`}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(test.id)}
                            onChange={() => toggleSelectId(test.id)}
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </td>
                        <td className={`px-4 ${rowPadding[rowHeight]} text-sm`}>
                          {test.pdf_path ? (
                            <button
                              onClick={() => handleViewPdf(test)}
                              className="text-blue-600 hover:text-blue-800 hover:underline text-left font-medium flex items-center gap-2"
                            >
                              <svg
                                className="w-4 h-4 text-red-500 flex-shrink-0"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              {highlightText(test.name, searchQuery)}
                              {test.description?.includes("メールから自動登録") && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded font-normal whitespace-nowrap" title="メールから自動登録されたテスト">📧 自動</span>
                              )}
                            </button>
                          ) : (
                            <span className="text-gray-700 flex items-center gap-2">
                              {highlightText(test.name, searchQuery)}
                              {test.description?.includes("メールから自動登録") && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded font-normal whitespace-nowrap" title="メールから自動登録されたテスト">📧 自動</span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className={`px-4 ${rowPadding[rowHeight]} text-sm`}>{highlightText(test.subject, searchQuery)}</td>
                        <td className={`px-4 ${rowPadding[rowHeight]} text-sm`}>{highlightText(test.grade, searchQuery)}</td>
                        <td className={`px-2 md:px-4 ${rowPadding[rowHeight]} text-sm`}>
                          {test.description ? (
                            <span
                              className="text-gray-600 italic text-xs md:text-sm"
                              title={test.description}
                            >
                              <span className="hidden xl:inline">
                                {test.description.length > 50
                                  ? `${test.description.substring(0, 50)}...`
                                  : test.description}
                              </span>
                              <span className="hidden lg:inline xl:hidden">
                                {test.description.length > 30
                                  ? `${test.description.substring(0, 30)}...`
                                  : test.description}
                              </span>
                              <span className="inline lg:hidden">
                                {test.description.length > 15
                                  ? `${test.description.substring(0, 15)}...`
                                  : test.description}
                              </span>
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className={`px-4 ${rowPadding[rowHeight]}`}>
                          <div className="flex flex-wrap gap-1">
                            {test.tags.map((tag) => (
                              <span
                                key={tag.id}
                                className="px-2 py-1 text-xs rounded"
                                style={{
                                  backgroundColor: tag.color + "20",
                                  color: tag.color,
                                }}
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className={`px-4 ${rowPadding[rowHeight]} text-sm text-gray-600`}>
                          {formatDate(test.created_at)}
                        </td>
                        <td className={`px-4 ${rowPadding[rowHeight]}`}>
                          <div className="flex gap-2 flex-wrap">
                            <Link
                              href={`/tests/${test.id}/edit`}
                              className="text-primary hover:text-primary-dark text-sm font-medium"
                            >
                              編集
                            </Link>
                            <button
                              onClick={() => handleCloneTest(test.id)}
                              className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                              title="複製"
                            >
                              複製
                            </button>
                            {deleteConfirm === test.id ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleDelete(test.id)}
                                  disabled={deleting}
                                  className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                                >
                                  {deleting ? "削除中..." : "確定"}
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  disabled={deleting}
                                  className="text-gray-600 hover:text-gray-700 text-sm font-medium disabled:opacity-50"
                                >
                                  キャンセル
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(test.id)}
                                className="text-red-600 hover:text-red-700 text-sm font-medium"
                              >
                                削除
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ページネーションコントロール */}
          {!loading && perPage > 0 && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 text-sm">
              <button
                onClick={() => setCurrentPage(0)}
                disabled={currentPage === 0}
                className="px-2 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 transition-colors"
                title="最初のページ"
              >
                «
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 transition-colors"
              >
                ‹ 前へ
              </button>

              {/* ページ番号ボタン */}
              {Array.from({ length: totalPages }, (_, i) => i)
                .filter((i) => Math.abs(i - currentPage) <= 2 || i === 0 || i === totalPages - 1)
                .reduce<(number | "...")[]>((acc, i, idx, arr) => {
                  if (idx > 0 && i - (arr[idx - 1] as number) > 1) acc.push("...");
                  acc.push(i);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "..." ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">…</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item as number)}
                      className={`px-3 py-1 rounded border transition-colors ${
                        currentPage === item
                          ? "bg-primary text-white border-primary"
                          : "border-gray-300 hover:bg-gray-100"
                      }`}
                    >
                      {(item as number) + 1}
                    </button>
                  )
                )}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage === totalPages - 1}
                className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 transition-colors"
              >
                次へ ›
              </button>
              <button
                onClick={() => setCurrentPage(totalPages - 1)}
                disabled={currentPage === totalPages - 1}
                className="px-2 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 transition-colors"
                title="最後のページ"
              >
                »
              </button>
              <span className="text-gray-500 ml-2">
                {currentPage + 1} / {totalPages} ページ
              </span>
            </div>
          )}
        </div>
      </div>

      {/* PDFビューワー */}
      {pdfViewerOpen && selectedPdfUrl && selectedTest && (
        <PdfViewer
          pdfUrl={selectedPdfUrl}
          attachments={testAttachments}
          testName={selectedTest.name}
          testId={selectedTest.id}
          onClose={handleClosePdfViewer}
        />
      )}

      {/* 管理者モーダル */}
      <AdminModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        onUpdate={() => {
          // フォルダとカテゴリを更新
          fetchTests();
          setCategoryRefreshTrigger((prev) => prev + 1);
        }}
        onExportCSV={handleExportCSV}
      />
    </div>
  );
}
