"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import Sidebar from "./Sidebar";
// #99 重いコンポーネントを動的インポートでコード分割
const PdfViewer = dynamic(() => import("./PdfViewer"), {
  loading: () => (
    <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
      PDFビューワーを読み込み中...
    </div>
  ),
  ssr: false,
});
const AdminModal = dynamic(() => import("./AdminModal"), {
  loading: () => null,
  ssr: false,
});
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

/** #123 シンプルなMarkdownレンダラー（メモ欄表示用）
 * **太字**, *斜体*, ~~打ち消し~~, `コード`, 改行 に対応
 */
function renderMarkdown(text: string): { __html: string } {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const html = escaped
    // 太字
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // 斜体
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/_(.*?)_/g, "<em>$1</em>")
    // 打ち消し
    .replace(/~~(.*?)~~/g, "<del>$1</del>")
    // インラインコード
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-0.5 rounded text-xs font-mono">$1</code>')
    // 改行
    .replace(/\n/g, "<br>");
  return { __html: html };
}

/** #123 Markdownのシンタックスを除去してプレーンテキストを返す */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n/g, " ");
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

  // #34 カラム表示切替（localStorageに永続化）
  const [visibleColumns, setVisibleColumns] = useLocalStorage<Record<string, boolean>>(
    "testlist-visible-columns",
    { name: true, subject: true, grade: true, memo: true, tags: true, date: true, actions: true }
  );
  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const columnLabels: Record<string, string> = {
    name: "テスト名", subject: "科目", grade: "学年",
    memo: "メモ", tags: "ラベル", date: "登録日", actions: "操作"
  };
  const toggleColumn = (col: string) => {
    setVisibleColumns((prev) => ({ ...prev, [col]: !prev[col] }));
  };

  // #35 列幅リサイズ（localStorageに永続化）
  const [colWidths, setColWidths] = useLocalStorage<Record<string, number>>(
    "testlist-col-widths",
    { name: 200, subject: 80, grade: 80, memo: 150, tags: 100, date: 90, actions: 100 }
  );
  const resizingRef = useRef<{ col: string; startX: number; startWidth: number } | null>(null);
  const handleColResizeStart = useCallback((col: string, e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = { col, startX: e.clientX, startWidth: colWidths[col] ?? 100 };
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const newWidth = Math.max(60, resizingRef.current.startWidth + delta);
      setColWidths((prev) => ({ ...prev, [resizingRef.current!.col]: newWidth }));
    };
    const onUp = () => {
      resizingRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [colWidths, setColWidths]);

  const { error: toastError, success: toastSuccess } = useToast();

  // 複数選択・一括操作
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"none" | "move" | "grade" | "subject" | "tag">("none");
  const [bulkTargetFolderId, setBulkTargetFolderId] = useState<string>("");
  const [bulkTargetGrade, setBulkTargetGrade] = useState("");
  const [bulkTargetSubject, setBulkTargetSubject] = useState("");
  const [bulkTargetTagId, setBulkTargetTagId] = useState<string>("");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // #89 エラー状態（リトライ対応）
  const [fetchError, setFetchError] = useState<string | null>(null);

  // #90 確認ダイアログ（confirm()の代替）
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
    detail?: string;
  } | null>(null);

  // #104 Undo削除
  const [undoQueue, setUndoQueue] = useState<{
    tests: TestWithTags[];
    timer: ReturnType<typeof setTimeout>;
    message: string;
  } | null>(null);

  // #44 詳細検索フィルタ
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [advDateFrom, setAdvDateFrom] = useLocalStorage<string>("testlist-adv-dateFrom", "");
  const [advDateTo, setAdvDateTo] = useLocalStorage<string>("testlist-adv-dateTo", "");
  const [advMinQ, setAdvMinQ] = useLocalStorage<string>("testlist-adv-minQ", "");
  const [advMaxQ, setAdvMaxQ] = useLocalStorage<string>("testlist-adv-maxQ", "");

  // #45 検索履歴（localStorageに保存）
  const [searchHistory, setSearchHistory] = useLocalStorage<string[]>("testlist-search-history", []);
  const [showSearchHistory, setShowSearchHistory] = useState(false);

  // #46 複数タグフィルタ
  const [selectedTagIds, setSelectedTagIds] = useLocalStorage<number[]>("testlist-tag-ids", []);
  const [tagFilterMode, setTagFilterMode] = useLocalStorage<"AND" | "OR">("testlist-tag-mode", "OR");

  // #47 フィルタプリセット
  const [filterPresets, setFilterPresets] = useLocalStorage<{name: string; tagIds: number[]; mode: "AND"|"OR"; dateFrom: string; dateTo: string}[]>("testlist-filter-presets", []);
  const [showPresetSave, setShowPresetSave] = useState(false);
  const [presetName, setPresetName] = useState("");

  // #119 コメントモーダル
  const [commentModal, setCommentModal] = useState<{ testId: number; testName: string } | null>(null);
  const [comments, setComments] = useState<{ id: number; content: string; device_hint: string | null; created_at: string }[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  // #124 変更履歴モーダル
  const [historyModal, setHistoryModal] = useState<{ testId: number; testName: string } | null>(null);
  const [historyEntries, setHistoryEntries] = useState<{ id: number; action: string; device_hint: string | null; created_at: string }[]>([]);

  // #118 関連テストモーダル
  const [relatedModal, setRelatedModal] = useState<{ testId: number; testName: string } | null>(null);
  const [relatedTests, setRelatedTests] = useState<{ id: number; name: string; subject: string | null; grade: string | null }[]>([]);
  const [relatedSearchQuery, setRelatedSearchQuery] = useState("");

  // フォルダデータを取得してパンくずリスト用に使用
  const { data: foldersData } = useFolders();
  const folders = useMemo(() => foldersData || [], [foldersData]);

  // パンくずリストを構築（useMemoでメモ化）
  const breadcrumbs = useMemo(() => {
    if (!selectedFolderId) return [];
    return buildBreadcrumbs(folders, selectedFolderId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders, selectedFolderId]);

  // 表示設定に基づきソート済み・フィルタ済みテスト一覧を生成（#44 #46 詳細検索・複数タグ）
  const sortedTests = useMemo(() => {
    let filtered = [...tests];

    // #46 複数タグフィルタ（AND/OR）
    if (selectedTagIds.length > 0) {
      filtered = filtered.filter((test) => {
        const testTagIds = (test.tags || []).map((t) => t.id);
        if (tagFilterMode === "AND") {
          return selectedTagIds.every((tid) => testTagIds.includes(tid));
        } else {
          return selectedTagIds.some((tid) => testTagIds.includes(tid));
        }
      });
    }

    // #44 詳細検索フィルタ
    if (advDateFrom) {
      const from = new Date(advDateFrom).getTime();
      filtered = filtered.filter((t) => new Date(t.created_at).getTime() >= from);
    }
    if (advDateTo) {
      const to = new Date(advDateTo + "T23:59:59").getTime();
      filtered = filtered.filter((t) => new Date(t.created_at).getTime() <= to);
    }
    if (advMinQ) {
      const min = Number(advMinQ);
      filtered = filtered.filter((t) => t.total_questions != null && t.total_questions >= min);
    }
    if (advMaxQ) {
      const max = Number(advMaxQ);
      filtered = filtered.filter((t) => t.total_questions != null && t.total_questions <= max);
    }

    return filtered.sort((a, b) => {
      if (sortOrder === "name") return a.name.localeCompare(b.name, "ja");
      if (sortOrder === "oldest")
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [tests, sortOrder, selectedTagIds, tagFilterMode, advDateFrom, advDateTo, advMinQ, advMaxQ]);

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
    compact: "py-0.5",
    standard: "py-2",
    wide: "py-3",
  };

  const fetchTests = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const params = new URLSearchParams();

      if (selectedFolderId)
        params.append("folderId", selectedFolderId.toString());
      if (selectedCategory?.grade)
        params.append("grade", selectedCategory.grade);
      if (selectedCategory?.subject)
        params.append("subject", selectedCategory.subject);
      // 単一タグフィルタ（レガシー互換）- 複数タグはクライアントでフィルタ
      if (selectedTagId) params.append("tagId", selectedTagId.toString());
      if (searchQuery) params.append("search", searchQuery);

      const response = await fetch(`/api/tests?${params}`);
      if (!response.ok) throw new Error("テストの取得に失敗しました");
      const data = await response.json();
      setTests(data);

      // #45 検索履歴に追加（空でなく、重複しない場合）
      if (searchQuery.trim() && !searchHistory.includes(searchQuery.trim())) {
        setSearchHistory([searchQuery.trim(), ...searchHistory.slice(0, 9)]);
      }
    } catch (error) {
      console.error("テスト取得エラー:", error);
      setFetchError(error instanceof Error ? error.message : "テストの読み込みに失敗しました");
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // #91 ブラウザの戻るボタンでPDFビューワーを閉じる
  useEffect(() => {
    const onPopState = (_e: PopStateEvent) => {
      // history.back() で遷移してきた場合はビューワーを閉じる（既に閉じていれば無害）
      setPdfViewerOpen(false);
      setSelectedPdfUrl(null);
      setSelectedTest(null);
      setTestAttachments([]);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // PDFプレビュー表示
  const handleViewPdf = async (test: TestWithTags) => {
    // #91 戻るボタン対応: 履歴スタックにプッシュ
    window.history.pushState({ pdfOpen: true, testId: test.id }, "");
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
    // #91 戻るボタン対応: X ボタンで閉じた場合もブラウザ履歴を戻す
    if (window.history.state?.pdfOpen) {
      window.history.back();
    }
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

  // #90 確認ダイアログを開く ヘルパー
  const showConfirm = (message: string, onConfirm: () => void, detail?: string) => {
    setConfirmDialog({ message, onConfirm, detail });
  };

  // #42 ドラッグ&ドロップでテストをフォルダに移動
  const handleTestMoveToFolder = async (testId: number, folderId: number) => {
    try {
      const res = await fetch(`/api/tests/${testId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: folderId }),
      });
      if (!res.ok) throw new Error("移動に失敗しました");
      toastSuccess("テストをフォルダに移動しました");
      fetchTests();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "移動に失敗しました");
    }
  };

  // #104 Undo削除：楽観的に一覧から削除し、タイマー後に本削除
  const handleDeleteWithUndo = (test: TestWithTags) => {
    // 既存の Undo があればキャンセル（即実行）
    if (undoQueue) {
      clearTimeout(undoQueue.timer);
      // 既存の削除を即実行（非同期、エラーは無視）
      undoQueue.tests.forEach((t) => {
        fetch(`/api/tests/${t.id}`, { method: "DELETE" }).catch(() => {});
      });
    }
    // 楽観的に一覧から除去
    setTests((prev) => prev.filter((t) => t.id !== test.id));
    setDeleteConfirm(null);
    setCategoryRefreshTrigger((prev) => prev + 1);

    const timer = setTimeout(async () => {
      try {
        await fetch(`/api/tests/${test.id}`, { method: "DELETE" });
        setUndoQueue(null);
      } catch {
        // 削除失敗時は復元
        toastError("削除に失敗しました。テストを復元します。");
        await fetchTests();
        setUndoQueue(null);
      }
    }, 8000);

    setUndoQueue({ tests: [test], timer, message: `「${test.name}」を削除しました` });
  };

  // #104 Undo をキャンセル（テストを復元）
  const handleUndoDelete = () => {
    if (!undoQueue) return;
    clearTimeout(undoQueue.timer);
    setUndoQueue(null);
    fetchTests(); // 実際のDB状態を再取得して復元
    toastSuccess("削除を取り消しました");
  };

  // #39 一括印刷
  const handleBulkPrint = () => {
    if (selectedIds.size === 0) return;
    const selectedTests = tests.filter((t) => selectedIds.has(t.id) && t.pdf_path);
    if (selectedTests.length === 0) {
      toastError("選択したテストにPDFがありません");
      return;
    }
    // 各PDFをiframeで印刷
    selectedTests.forEach((test, i) => {
      setTimeout(() => {
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = test.pdf_path!;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          iframe.contentWindow?.print();
          setTimeout(() => document.body.removeChild(iframe), 3000);
        };
      }, i * 1500);
    });
    toastSuccess(`${selectedTests.length}件のPDFを印刷中...`);
  };

  // #47 フィルタプリセット保存
  const saveFilterPreset = () => {
    if (!presetName.trim()) return;
    const newPreset = {
      name: presetName.trim(),
      tagIds: selectedTagIds,
      mode: tagFilterMode,
      dateFrom: advDateFrom,
      dateTo: advDateTo,
    };
    setFilterPresets([newPreset, ...filterPresets.filter((p) => p.name !== presetName.trim())]);
    setPresetName("");
    setShowPresetSave(false);
    toastSuccess("フィルタプリセットを保存しました");
  };

  // #47 フィルタプリセット適用
  const applyFilterPreset = (p: typeof filterPresets[0]) => {
    setSelectedTagIds(p.tagIds);
    setTagFilterMode(p.mode);
    setAdvDateFrom(p.dateFrom);
    setAdvDateTo(p.dateTo);
    setCurrentPage(0);
    toastSuccess(`プリセット「${p.name}」を適用しました`);
  };

  // 詳細フィルタが有効かどうか
  const hasAdvancedFilter = (selectedTagIds.length > 0 || !!advDateFrom || !!advDateTo || !!advMinQ || !!advMaxQ);

  // #119 コメントモーダルを開いてコメント一覧を取得
  const openCommentModal = async (test: TestWithTags) => {
    setCommentModal({ testId: test.id, testName: test.name });
    setCommentInput("");
    setCommentLoading(true);
    try {
      const res = await fetch(`/api/tests/${test.id}/comments`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch {
      setComments([]);
    } finally {
      setCommentLoading(false);
    }
  };

  const submitComment = async () => {
    if (!commentModal || !commentInput.trim()) return;
    setCommentLoading(true);
    try {
      const res = await fetch(`/api/tests/${commentModal.testId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) => [...prev, data.comment]);
        setCommentInput("");
      } else {
        toastError(data.error || "コメントの追加に失敗しました");
      }
    } catch {
      toastError("コメントの追加に失敗しました");
    } finally {
      setCommentLoading(false);
    }
  };

  const deleteComment = async (commentId: number) => {
    if (!commentModal) return;
    try {
      await fetch(`/api/tests/${commentModal.testId}/comments?commentId=${commentId}`, { method: "DELETE" });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      toastError("コメントの削除に失敗しました");
    }
  };

  // #124 変更履歴モーダルを開く
  const openHistoryModal = async (test: TestWithTags) => {
    setHistoryModal({ testId: test.id, testName: test.name });
    try {
      const res = await fetch(`/api/tests/${test.id}/history`);
      const data = await res.json();
      setHistoryEntries(data.history || []);
    } catch {
      setHistoryEntries([]);
    }
  };

  // #118 関連テストモーダルを開く
  const openRelatedModal = async (test: TestWithTags) => {
    setRelatedModal({ testId: test.id, testName: test.name });
    setRelatedSearchQuery("");
    try {
      const res = await fetch(`/api/tests/${test.id}/related`);
      const data = await res.json();
      setRelatedTests(data.related || []);
    } catch {
      setRelatedTests([]);
    }
  };

  const addRelatedTest = async (relatedTestId: number) => {
    if (!relatedModal) return;
    try {
      await fetch(`/api/tests/${relatedModal.testId}/related`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relatedTestId }),
      });
      // リロード
      const res = await fetch(`/api/tests/${relatedModal.testId}/related`);
      const data = await res.json();
      setRelatedTests(data.related || []);
    } catch {
      toastError("関連テストの追加に失敗しました");
    }
  };

  const removeRelatedTest = async (relatedTestId: number) => {
    if (!relatedModal) return;
    try {
      await fetch(`/api/tests/${relatedModal.testId}/related?relatedTestId=${relatedTestId}`, { method: "DELETE" });
      setRelatedTests((prev) => prev.filter((t) => t.id !== relatedTestId));
    } catch {
      toastError("関連テストの削除に失敗しました");
    }
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden">
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
          onTestMove={handleTestMoveToFolder}
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

              {/* 検索バー (#43 #45) */}
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="キーワード、科目、学年で検索..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowSearchHistory(false); }}
                  onFocus={() => searchHistory.length > 0 && setShowSearchHistory(true)}
                  onBlur={() => setTimeout(() => setShowSearchHistory(false), 200)}
                  className="w-full pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                )}
                {/* #45 検索履歴ドロップダウン */}
                {showSearchHistory && searchHistory.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-30 mt-1 max-h-48 overflow-auto">
                    <p className="text-xs text-gray-400 px-3 pt-2 pb-1">最近の検索</p>
                    {searchHistory.map((h, i) => (
                      <button key={i} onClick={() => { setSearchQuery(h); setShowSearchHistory(false); }}
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors">
                        <svg className="inline w-3.5 h-3.5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {h}
                      </button>
                    ))}
                    <button onClick={() => { setSearchHistory([]); setShowSearchHistory(false); }}
                      className="block w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 border-t border-gray-100">
                      履歴をクリア
                    </button>
                  </div>
                )}
              </div>

              {/* 詳細検索ボタン (#44) */}
              <button
                onClick={() => setShowAdvancedSearch((v) => !v)}
                title="詳細検索・フィルタ"
                className={`flex items-center gap-1 px-3 py-2.5 border rounded-lg transition-colors text-sm whitespace-nowrap ${
                  showAdvancedSearch || hasAdvancedFilter
                    ? "bg-primary text-white border-primary"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span className="hidden sm:inline">詳細</span>
                {hasAdvancedFilter && <span className="w-2 h-2 bg-yellow-300 rounded-full" />}
              </button>
            </div>

            {/* 新規テスト登録ボタン */}
            <Link
              href="/tests/new"
              className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg transition-colors flex items-center gap-2 justify-center whitespace-nowrap"
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

          {/* #44 詳細検索パネル（折りたたみ可能） */}
          {showAdvancedSearch && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm">
              <div className="flex flex-wrap gap-3 items-end">
                {/* 登録日範囲 */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">登録日（開始）</label>
                  <input type="date" value={advDateFrom} onChange={(e) => setAdvDateFrom(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">登録日（終了）</label>
                  <input type="date" value={advDateTo} onChange={(e) => setAdvDateTo(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white" />
                </div>
                {/* 大問数範囲 */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">大問数（最小）</label>
                  <input type="number" min={0} value={advMinQ} onChange={(e) => setAdvMinQ(e.target.value)}
                    placeholder="0" className="border border-gray-300 rounded px-3 py-2 text-sm w-20 focus:outline-none focus:ring-1 focus:ring-primary bg-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">大問数（最大）</label>
                  <input type="number" min={0} value={advMaxQ} onChange={(e) => setAdvMaxQ(e.target.value)}
                    placeholder="∞" className="border border-gray-300 rounded px-3 py-2 text-sm w-20 focus:outline-none focus:ring-1 focus:ring-primary bg-white" />
                </div>

                {/* #46 複数タグフィルタ */}
                <div className="flex-1 min-w-0">
                  <label className="block text-xs text-gray-500 mb-1">
                    ラベルフィルタ
                    <span className="ml-2 inline-flex rounded border border-gray-300 overflow-hidden">
                      {(["OR", "AND"] as const).map((m) => (
                        <button key={m} onClick={() => setTagFilterMode(m)}
                          className={`px-2 py-1.5 text-xs transition-colors ${tagFilterMode === m ? "bg-primary text-white" : "bg-white text-gray-600"}`}>
                          {m}
                        </button>
                      ))}
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <button key={tag.id}
                        onClick={() => setSelectedTagIds(
                          selectedTagIds.includes(tag.id)
                            ? selectedTagIds.filter((i) => i !== tag.id)
                            : [...selectedTagIds, tag.id]
                        )}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          selectedTagIds.includes(tag.id)
                            ? "text-white border-transparent"
                            : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                        }`}
                        style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color || "#3B82F6" } : {}}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* フィルタクリア・プリセット */}
                <div className="flex gap-2">
                  {hasAdvancedFilter && (
                    <button onClick={() => { setSelectedTagIds([]); setAdvDateFrom(""); setAdvDateTo(""); setAdvMinQ(""); setAdvMaxQ(""); setCurrentPage(0); }}
                      className="px-4 py-2 text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors">
                      クリア
                    </button>
                  )}
                  {/* #47 プリセット保存 */}
                  <button onClick={() => setShowPresetSave((v) => !v)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors">
                    保存
                  </button>
                </div>
              </div>

              {/* プリセット保存フォーム */}
              {showPresetSave && (
                <div className="mt-2 flex gap-2 items-center">
                  <input type="text" value={presetName} onChange={(e) => setPresetName(e.target.value)}
                    placeholder="プリセット名..."
                    className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-1 focus:ring-primary" />
                  <button onClick={saveFilterPreset} disabled={!presetName.trim()}
                    className="px-4 py-2 bg-primary text-white rounded text-sm disabled:opacity-50 hover:bg-primary-dark">追加</button>
                  <button onClick={() => setShowPresetSave(false)} className="px-4 py-2 text-gray-500 text-sm hover:text-gray-700">×</button>
                </div>
              )}

              {/* #47 保存済みプリセット一覧 */}
              {filterPresets.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {filterPresets.map((p, i) => (
                    <div key={i} className="flex items-center gap-0.5 border border-gray-300 rounded-full overflow-hidden text-xs">
                      <button onClick={() => applyFilterPreset(p)} className="px-3 py-2 hover:bg-gray-50 transition-colors">{p.name}</button>
                      <button onClick={() => setFilterPresets(filterPresets.filter((_, fi) => fi !== i))}
                        className="px-2 py-2 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
                className="border border-gray-300 rounded px-2 py-2 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
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
                className={`px-3 py-2.5 flex items-center gap-1 transition-colors ${
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
                className={`px-3 py-2.5 flex items-center gap-1 transition-colors border-l border-gray-300 ${
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
                    className={`px-2 py-2.5 transition-colors ${i > 0 ? "border-l border-gray-300" : ""} ${
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
                className="border border-gray-300 rounded px-2 py-2 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
              >
                <option value={10}>10件</option>
                <option value={25}>25件</option>
                <option value={50}>50件</option>
                <option value={100}>100件</option>
                <option value={0}>全件</option>
              </select>
            </div>

            {/* 標準表示に戻すボタン（設定変更時のみ表示） */}
            {(sortOrder !== "newest" || viewMode !== "list" || rowHeight !== "standard" || perPage !== 25 || Object.values(visibleColumns).some(v => v === false)) && (
              <button
                onClick={() => {
                  setSortOrder("newest");
                  setViewMode("list");
                  setRowHeight("standard");
                  setPerPage(25);
                  setCurrentPage(0);
                  setVisibleColumns({ name: true, subject: true, grade: true, memo: true, tags: true, date: true, actions: true });
                  setColWidths({ name: 200, subject: 80, grade: 80, memo: 150, tags: 100, date: 90, actions: 100 });
                }}
                className="flex items-center gap-1 px-4 py-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                標準表示に戻す
              </button>
            )}

            {/* #34 カラム表示切替 */}
            {viewMode === "list" && (
              <div className="relative">
                <button
                  onClick={() => setShowColumnToggle((v) => !v)}
                  title="表示列を切替"
                  className={`flex items-center gap-1 px-3 py-2 border rounded-lg transition-colors text-sm ${
                    showColumnToggle ? "bg-primary text-white border-primary" : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                  <span className="hidden sm:inline">列</span>
                </button>
                {showColumnToggle && (
                  <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-50 min-w-[120px]">
                    {Object.keys(columnLabels).map((col) => (
                      <label key={col} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={visibleColumns[col] !== false}
                          onChange={() => toggleColumn(col)}
                          className="rounded"
                          disabled={col === "name"}
                        />
                        <span className={col === "name" ? "text-gray-400" : "text-gray-700"}>{columnLabels[col]}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
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
                  showConfirm(`${selectedIds.size}件のテストを削除しますか？`, handleBulkDelete, 'この操作は取り消せません。');
                }}
                disabled={bulkProcessing}
                className="flex items-center gap-1 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors disabled:opacity-50"
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
                    className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  >
                    <option value="">フォルダを選択...</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => { if (bulkTargetFolderId) handleBulkUpdate({ folderId: Number(bulkTargetFolderId) }); }}
                    disabled={!bulkTargetFolderId || bulkProcessing}
                    className="px-3 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50 hover:bg-blue-700"
                  >
                    移動
                  </button>
                  <button onClick={() => setBulkAction("none")} className="px-3 py-2 text-gray-500 text-sm hover:text-gray-700">×</button>
                </div>
              ) : (
                <button
                  onClick={() => setBulkAction("move")}
                  className="flex items-center gap-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
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
                    className="border rounded px-3 py-2 text-sm w-28 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => { if (bulkTargetGrade) handleBulkUpdate({ grade: bulkTargetGrade }); }}
                    disabled={!bulkTargetGrade || bulkProcessing}
                    className="px-3 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50 hover:bg-blue-700"
                  >
                    変更
                  </button>
                  <button onClick={() => setBulkAction("none")} className="px-3 py-2 text-gray-500 text-sm hover:text-gray-700">×</button>
                </div>
              ) : (
                <button
                  onClick={() => setBulkAction("grade")}
                  className="flex items-center gap-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
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
                    className="border rounded px-3 py-2 text-sm w-28 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => { if (bulkTargetSubject) handleBulkUpdate({ subject: bulkTargetSubject }); }}
                    disabled={!bulkTargetSubject || bulkProcessing}
                    className="px-3 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50 hover:bg-blue-700"
                  >
                    変更
                  </button>
                  <button onClick={() => setBulkAction("none")} className="px-3 py-2 text-gray-500 text-sm hover:text-gray-700">×</button>
                </div>
              ) : (
                <button
                  onClick={() => setBulkAction("subject")}
                  className="flex items-center gap-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
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
                    className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  >
                    <option value="">ラベルを選択...</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => { if (bulkTargetTagId) handleBulkUpdate({ addTagIds: [Number(bulkTargetTagId)] }); }}
                    disabled={!bulkTargetTagId || bulkProcessing}
                    className="px-3 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50 hover:bg-blue-700"
                  >
                    付与
                  </button>
                  <button onClick={() => setBulkAction("none")} className="px-3 py-2 text-gray-500 text-sm hover:text-gray-700">×</button>
                </div>
              ) : (
                <button
                  onClick={() => setBulkAction("tag")}
                  className="flex items-center gap-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  ラベル付与
                </button>
              )}

              {/* #39 一括印刷 */}
              <button
                onClick={handleBulkPrint}
                disabled={bulkProcessing}
                className="flex items-center gap-1 px-4 py-2 bg-purple-50 border border-purple-300 text-purple-700 rounded hover:bg-purple-100 transition-colors disabled:opacity-50"
                title="選択したテストのPDFを印刷"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                一括印刷
              </button>

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

        {/* #89 エラーバー */}
        {fetchError && !loading && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700 text-sm flex-1">{fetchError}</p>
            <button
              onClick={fetchTests}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
            >
              再試行
            </button>
          </div>
        )}

        {/* #104 Undo バー */}
        {undoQueue && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-3 rounded-lg flex items-center gap-4 shadow-lg z-50">
            <span className="text-sm">{undoQueue.message}</span>
            <button
              onClick={handleUndoDelete}
              className="px-3 py-1 bg-white text-gray-800 rounded text-sm hover:bg-gray-100 transition-colors"
            >
              取り消す
            </button>
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
                {searchQuery || selectedTagIds.length > 0 || selectedCategory || hasAdvancedFilter ? (
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
                    {/* PDFプレビュー */}
                    {test.pdf_path && (
                      <div
                        className="w-full h-28 bg-gray-100 rounded overflow-hidden cursor-pointer flex-shrink-0"
                        onClick={() => handleViewPdf(test)}
                        title="PDFを開く"
                      >
                        <object
                          data={test.pdf_path}
                          type="application/pdf"
                          className="w-full h-full pointer-events-none"
                        >
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-10 h-10 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </object>
                      </div>
                    )}
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

                    {/* メモ (#123 Markdown対応) */}
                    {test.description && (
                      <p
                        className="text-xs text-gray-500 italic line-clamp-2"
                        dangerouslySetInnerHTML={renderMarkdown(test.description)}
                      />
                    )}

                    {/* フッター：登録日 + 操作 */}
                    <div className="flex items-center justify-between mt-auto pt-2 border-t">
                      <span className="text-xs text-gray-400">{formatDate(test.created_at)}</span>
                      <div className="flex gap-2">
                        <Link
                          href={`/tests/${test.id}/edit`}
                          className="text-sm text-primary hover:text-primary-dark font-medium py-1.5 px-2 rounded hover:bg-primary/10 transition-colors"
                        >
                          編集
                        </Link>
                        <button
                          onClick={() => handleDeleteWithUndo(test)}
                          className="text-sm text-red-600 hover:text-red-700 font-medium py-1.5 px-2 rounded hover:bg-red-50 transition-colors"
                          title="削除（8秒以内に取り消せます）"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col style={{ width: 40 }} />
                    <col style={{ width: colWidths["name"] ?? 240 }} />
                    {visibleColumns["subject"] !== false && <col style={{ width: colWidths["subject"] ?? 100 }} />}
                    {visibleColumns["grade"] !== false && <col style={{ width: colWidths["grade"] ?? 100 }} />}
                    {visibleColumns["memo"] !== false && <col style={{ width: colWidths["memo"] ?? 180 }} />}
                    {visibleColumns["tags"] !== false && <col style={{ width: colWidths["tags"] ?? 140 }} />}
                    {visibleColumns["date"] !== false && <col style={{ width: colWidths["date"] ?? 110 }} />}
                    {visibleColumns["actions"] !== false && <col style={{ width: colWidths["actions"] ?? 120 }} />}
                  </colgroup>
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
                      {(["name", "subject", "grade", "memo", "tags", "date", "actions"] as const).map((col) => {
                        if (col !== "name" && visibleColumns[col] === false) return null;
                        return (
                          <th key={col} className="relative px-4 py-3 text-left text-sm font-semibold text-gray-700 select-none overflow-hidden">
                            <span className="truncate block pr-2">{columnLabels[col]}</span>
                            {/* リサイズハンドル */}
                            <div
                              onMouseDown={(e) => handleColResizeStart(col, e)}
                              className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-blue-300 opacity-0 hover:opacity-60 transition-opacity"
                              title="ドラッグで列幅を変更"
                            />
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paginatedTests.map((test) => (
                      <tr
                        key={test.id}
                        tabIndex={0}
                        draggable
                        onKeyDown={(e) => {
                          // #93 キーボードナビゲーション
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (test.pdf_path) handleViewPdf(test);
                          } else if (e.key === "ArrowDown") {
                            e.preventDefault();
                            const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                            if (next) next.focus();
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            const prev = e.currentTarget.previousElementSibling as HTMLElement | null;
                            if (prev) prev.focus();
                          }
                        }}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", String(test.id));
                          e.dataTransfer.setData("application/test-id", String(test.id));
                          e.dataTransfer.effectAllowed = "move";
                          (e.currentTarget as HTMLElement).style.opacity = "0.5";
                        }}
                        onDragEnd={(e) => {
                          (e.currentTarget as HTMLElement).style.opacity = "";
                        }}
                        title="ドラッグしてフォルダに移動 / Enter でPDF表示"
                        className={`hover:bg-gray-50 transition-colors cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary ${selectedIds.has(test.id) ? "bg-blue-50" : ""}`}
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
                        {visibleColumns["subject"] !== false && (
                        <td className={`px-4 ${rowPadding[rowHeight]} text-sm`}>{highlightText(test.subject, searchQuery)}</td>
                        )}
                        {visibleColumns["grade"] !== false && (
                        <td className={`px-4 ${rowPadding[rowHeight]} text-sm`}>{highlightText(test.grade, searchQuery)}</td>
                        )}
                        {visibleColumns["memo"] !== false && (
                        <td className={`px-2 md:px-4 ${rowPadding[rowHeight]} text-sm`}>
                          {test.description ? (
                            <span
                              className="text-gray-600 italic text-xs md:text-sm"
                              title={test.description}
                            >
                              {(() => {
                                // #123 Markdown記号を除去した平文を表示
                                const plain = stripMarkdown(test.description);
                                return (
                                  <>
                                    <span className="hidden xl:inline">
                                      {plain.length > 50 ? `${plain.substring(0, 50)}...` : plain}
                                    </span>
                                    <span className="hidden lg:inline xl:hidden">
                                      {plain.length > 30 ? `${plain.substring(0, 30)}...` : plain}
                                    </span>
                                    <span className="inline lg:hidden">
                                      {plain.length > 15 ? `${plain.substring(0, 15)}...` : plain}
                                    </span>
                                  </>
                                );
                              })()}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        )}
                        {visibleColumns["tags"] !== false && (
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
                        )}
                        {visibleColumns["date"] !== false && (
                        <td className={`px-4 ${rowPadding[rowHeight]} text-sm text-gray-600`}>
                          {formatDate(test.created_at)}
                        </td>
                        )}
                        {visibleColumns["actions"] !== false && (
                        <td className={`px-4 ${rowPadding[rowHeight]}`}>
                          <div className="flex gap-2 flex-wrap items-center">
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
                            {/* #119 コメント */}
                            <button
                              onClick={() => openCommentModal(test)}
                              className="text-gray-400 hover:text-gray-700 p-2 rounded hover:bg-gray-100"
                              title="コメント"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                            </button>
                            {/* #124 変更履歴 */}
                            <button
                              onClick={() => openHistoryModal(test)}
                              className="text-gray-400 hover:text-gray-700 p-2 rounded hover:bg-gray-100"
                              title="変更履歴"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                            {/* #118 関連テスト */}
                            <button
                              onClick={() => openRelatedModal(test)}
                              className="text-gray-400 hover:text-gray-700 p-2 rounded hover:bg-gray-100"
                              title="関連テスト"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteWithUndo(test)}
                              className="text-red-600 hover:text-red-700 text-sm font-medium"
                              title="削除（8秒以内に取り消せます）"
                            >
                              削除
                            </button>
                          </div>
                        </td>
                        )}
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
                className="px-3 py-2 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 transition-colors"
                title="最初のページ"
              >
                «
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="px-3 py-2 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 transition-colors"
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
                      className={`px-3 py-2 rounded border transition-colors ${
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
                className="px-3 py-2 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 transition-colors"
              >
                次へ ›
              </button>
              <button
                onClick={() => setCurrentPage(totalPages - 1)}
                disabled={currentPage === totalPages - 1}
                className="px-3 py-2 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 transition-colors"
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
        <div id="pdf-viewer-overlay">
          <PdfViewer
            pdfUrl={selectedPdfUrl}
            attachments={testAttachments}
            testName={selectedTest.name}
            testId={selectedTest.id}
            onClose={handleClosePdfViewer}
          />
        </div>
      )}

      {/* #90 確認ダイアログ */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" onClick={() => setConfirmDialog(null)}>
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-800">{confirmDialog.message}</p>
                {confirmDialog.detail && <p className="text-sm text-gray-500 mt-1">{confirmDialog.detail}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* #119 コメントモーダル */}
      {commentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" onClick={() => setCommentModal(null)}>
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-md w-full mx-4 flex flex-col gap-4 max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">コメント</h3>
              <button onClick={() => setCommentModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-500 -mt-2 truncate">{commentModal.testName}</p>
            <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
              {commentLoading ? (
                <div className="text-center py-4 text-gray-400 text-sm">読み込み中...</div>
              ) : comments.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm">まだコメントはありません</div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="bg-gray-50 rounded-lg p-3 flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.content}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(c.created_at).toLocaleString("ja-JP")}
                        {c.device_hint && ` · ${c.device_hint}`}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteComment(c.id)}
                      className="text-gray-300 hover:text-red-500 text-xs flex-shrink-0"
                      title="削除"
                    >✕</button>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <textarea
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) submitComment(); }}
                placeholder="コメントを入力... (Ctrl+Enter で投稿)"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={2}
              />
              <button
                onClick={submitComment}
                disabled={commentLoading || !commentInput.trim()}
                className="px-4 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 text-sm transition-colors"
              >
                投稿
              </button>
            </div>
          </div>
        </div>
      )}

      {/* #124 変更履歴モーダル */}
      {historyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" onClick={() => setHistoryModal(null)}>
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800">変更履歴</h3>
              <button onClick={() => setHistoryModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-4 truncate">{historyModal.testName}</p>
            <div className="flex-1 overflow-y-auto">
              {historyEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">変更履歴がありません</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium">操作</th>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium">端末</th>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium">日時</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {historyEntries.map((h) => (
                      <tr key={h.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-700">{h.action}</td>
                        <td className="px-3 py-2 text-gray-500">{h.device_hint || "-"}</td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                          {new Date(h.created_at).toLocaleString("ja-JP")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* #118 関連テストモーダル */}
      {relatedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" onClick={() => setRelatedModal(null)}>
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-md w-full mx-4 max-h-[80vh] flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">関連テスト</h3>
              <button onClick={() => setRelatedModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-500 -mt-2 truncate">{relatedModal.testName}</p>
            {/* 現在の関連テスト */}
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {relatedTests.length === 0 ? (
                <div className="text-sm text-gray-400 py-2">関連テストなし</div>
              ) : (
                relatedTests.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <Link href={`/tests/${t.id}/edit`} className="flex-1 text-sm text-primary hover:underline truncate">
                      {t.name}
                    </Link>
                    {t.subject && <span className="text-xs text-gray-400">{t.subject}</span>}
                    {t.grade && <span className="text-xs text-gray-400">{t.grade}</span>}
                    <button onClick={() => removeRelatedTest(t.id)} className="text-gray-300 hover:text-red-500 text-xs" title="解除">✕</button>
                  </div>
                ))
              )}
            </div>
            {/* テスト検索して追加 */}
            <div className="pt-2 border-t">
              <p className="text-xs text-gray-500 mb-2">テストを検索して追加:</p>
              <input
                type="text"
                value={relatedSearchQuery}
                onChange={(e) => setRelatedSearchQuery(e.target.value)}
                placeholder="テスト名で検索..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary mb-2"
              />
              {relatedSearchQuery.trim() && (
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {tests
                    .filter((t) =>
                      t.id !== relatedModal.testId &&
                      !relatedTests.some((r) => r.id === t.id) &&
                      t.name.toLowerCase().includes(relatedSearchQuery.toLowerCase())
                    )
                    .slice(0, 5)
                    .map((t) => (
                      <button
                        key={t.id}
                        onClick={() => addRelatedTest(t.id)}
                        className="w-full text-left text-sm px-3 py-2 rounded hover:bg-blue-50 hover:text-blue-700 border border-transparent hover:border-blue-200 transition-colors truncate"
                      >
                        + {t.name}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
          </div>
        </div>
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
