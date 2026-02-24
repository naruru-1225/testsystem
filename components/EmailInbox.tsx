"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import PdfViewer from "./PdfViewer";
import { useToast } from "./ToastProvider";

interface InboxItem {
  id: number;
  file_name: string;
  file_path: string;
  original_subject: string | null;
  from_address: string | null;
  received_at: string;
  message_id: string | null;
  status: "pending" | "assigned" | "error";
  error_message: string | null;
}

type FilterStatus = "all" | "pending" | "assigned";

/**
 * メール受信トレイコンポーネント
 * 自動取込されたPDFを一覧表示し、テスト登録を行う
 */
export default function EmailInbox() {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("pending");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [previewItem, setPreviewItem] = useState<InboxItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = filterStatus !== "all" ? `?status=${filterStatus}` : "";
      const res = await fetch(`/api/inbox${params}`);
      if (!res.ok) throw new Error("受信トレイの取得に失敗しました");
      const data = await res.json();
      setItems(data.items);
      setPendingCount(data.pendingCount);
    } catch (err) {
      console.error("受信トレイ取得エラー:", err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // 全選択/全解除
  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  };

  // 選択切替
  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // 選択アイテムを削除
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`選択した ${selectedIds.size} 件を削除しますか？`)) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/inbox", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("削除に失敗しました");
      setSelectedIds(new Set());
      toast.success(`${selectedIds.size} 件を削除しました`);
      await fetchItems();
    } catch (err) {
      console.error("削除エラー:", err);
      toast.error("削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  };

  // 1件削除
  const handleDeleteOne = async (item: InboxItem) => {
    if (!confirm(`「${item.original_subject || item.file_name}」を削除しますか？`)) return;

    try {
      const res = await fetch(`/api/inbox/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("削除に失敗しました");
      if (previewItem?.id === item.id) setPreviewItem(null);
      toast.success("削除しました");
      await fetchItems();
    } catch (err) {
      console.error("削除エラー:", err);
      toast.error("削除に失敗しました");
    }
  };

  // テスト作成ページへ遷移（PDF引き継ぎ）
  const handleCreateTest = (item: InboxItem) => {
    const params = new URLSearchParams({
      pdfPath: item.file_path,
      inboxItemId: item.id.toString(),
    });
    if (item.original_subject) {
      params.set("name", item.original_subject);
    }
    router.push(`/tests/new?${params.toString()}`);
  };

  // #79 エラーアイテムを再試行（pending に戻す）
  const handleRetry = async (item: InboxItem) => {
    try {
      const res = await fetch(`/api/inbox/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });
      if (!res.ok) throw new Error("再試行に失敗しました");
      toast.success("再試行待ちに戻しました");
      await fetchItems();
    } catch (err) {
      console.error("再試行エラー:", err);
      toast.error("再試行に失敗しました");
    }
  };

  // シードデータ投入
  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/inbox/seed", { method: "POST" });
      if (!res.ok) throw new Error("シードデータの投入に失敗しました");
      const data = await res.json();
      toast.success(`${data.added} 件のテストデータを投入しました`);
      setFilterStatus("pending");
      await fetchItems();
    } catch (err) {
      console.error("シードエラー:", err);
      toast.error("シードデータの投入に失敗しました");
    } finally {
      setSeeding(false);
    }
  };

  // 日時フォーマット
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusLabel = (status: InboxItem["status"]) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            未処理
          </span>
        );
      case "assigned":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            登録済み
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            エラー
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b px-4 py-4 flex items-center gap-4">
        <button
          onClick={() => router.push("/")}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title="テスト一覧に戻る"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            メール受信トレイ
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500">メールから取り込まれたPDFを確認し、テストとして登録します</p>
        </div>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
        >
          {seeding ? "投入中..." : "テストデータ投入"}
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* フィルター＋操作バー */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* ステータスフィルター */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(["pending", "assigned", "all"] as FilterStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => { setFilterStatus(s); setSelectedIds(new Set()); }}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  filterStatus === s
                    ? "bg-blue-500 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {s === "pending" ? "未処理" : s === "assigned" ? "登録済み" : "すべて"}
              </button>
            ))}
          </div>

          {/* 選択操作 */}
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
            >
              {deleting ? "削除中..." : `選択削除 (${selectedIds.size}件)`}
            </button>
          )}

          <span className="ml-auto text-sm text-gray-500">
            {items.length} 件
          </span>
        </div>

        {/* PDFプレビューモーダル */}
        {previewItem && (
          <PdfViewer
            pdfUrl={previewItem.file_path}
            testName={previewItem.original_subject ?? previewItem.file_name}
            onClose={() => setPreviewItem(null)}
          />
        )}

        {loading ? (
          <div className="flex justify-center items-center h-48">
            <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-lg font-medium">
              {filterStatus === "pending" ? "未処理のPDFはありません" : "アイテムがありません"}
            </p>
            <p className="text-sm mt-1">メールから取り込まれたPDFがここに表示されます</p>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              テストデータを投入する
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* ヘッダー行 */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b text-xs font-medium text-gray-500">
              <input
                type="checkbox"
                checked={selectedIds.size === items.length && items.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300 text-blue-500"
              />
              <span className="flex-1">件名 / ファイル名</span>
              <span className="w-32 text-right hidden sm:block">受信日時</span>
              <span className="w-16 text-right">状態</span>
              <span className="w-32 text-right">操作</span>
            </div>

            {/* アイテム行 */}
            <div className="divide-y divide-gray-100">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 px-4 py-3 transition-colors ${
                    item.status === "assigned" ? "opacity-60 bg-gray-50" : "bg-white hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-500 flex-shrink-0"
                  />

                  {/* PDF アイコン */}
                  <svg className="w-8 h-8 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>

                  {/* テキスト */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.original_subject || item.file_name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {item.from_address || "不明"} · {item.file_name}
                    </p>
                  </div>

                  {/* 受信日時 */}
                  <span className="text-xs text-gray-400 w-32 text-right flex-shrink-0 hidden sm:block">
                    {formatDate(item.received_at)}
                  </span>

                  {/* ステータス */}
                  <div className="w-16 flex justify-end flex-shrink-0">
                    {statusLabel(item.status)}
                  </div>

                  {/* 操作ボタン */}
                  <div className="w-32 flex items-center justify-end gap-1 flex-shrink-0">
                    <button
                      onClick={() => setPreviewItem(item)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                      title="PDFをプレビュー"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    {item.status === "pending" && (
                      <button
                        onClick={() => handleCreateTest(item)}
                        className="px-3 py-1 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded transition-colors whitespace-nowrap"
                        title="テストを作成する"
                      >
                        登録
                      </button>
                    )}
                    {/* #79 エラー再試行ボタン */}
                    {item.status === "error" && (
                      <button
                        onClick={() => handleRetry(item)}
                        className="px-3 py-1 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 rounded transition-colors whitespace-nowrap"
                        title="再試行（保留に戻す）"
                      >
                        再試行
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteOne(item)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="削除"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
