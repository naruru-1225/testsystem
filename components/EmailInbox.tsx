"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useToast } from "./ToastProvider";

const PdfViewer = dynamic(() => import("./PdfViewer"), { ssr: false });

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

interface FolderOption { id: number; name: string; parent_id: number | null }

type FilterStatus = "all" | "pending" | "assigned";

/** 一括作成モーダル用の1行データ */
interface BatchRow {
  inboxId: number;
  fileName: string;
  pdfPath: string;
  testName: string;  // 編集可能
}

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

  // 一括テスト作成モーダル
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
  const [batchGrade, setBatchGrade] = useState("");
  const [batchSubject, setBatchSubject] = useState("");
  const [batchFolderId, setBatchFolderId] = useState<number | "">("");
  const [grades, setGrades] = useState<{id:number;name:string}[]>([]);
  const [subjects, setSubjects] = useState<{id:number;name:string}[]>([]);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [batchMode, setBatchMode] = useState<"separate" | "single">("separate");

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

  // 一括テスト作成モーダルを開く
  const handleOpenBatchModal = async () => {
    const pendingSelected = items.filter(
      (i) => selectedIds.has(i.id) && i.status === "pending"
    );
    if (pendingSelected.length === 0) {
      toast.error("未処理のPDFを選択してください");
      return;
    }
    // grades / subjects / folders を並列取得
    const [grRes, subRes, folRes] = await Promise.all([
      fetch("/api/grades"),
      fetch("/api/subjects"),
      fetch("/api/folders"),
    ]);
    const [grData, subData, folData] = await Promise.all([
      grRes.json(),
      subRes.json(),
      folRes.json(),
    ]);
    setGrades(grData.grades ?? grData ?? []);
    setSubjects(subData.subjects ?? subData ?? []);
    setFolders(folData.folders ?? folData ?? []);
    setBatchRows(
      pendingSelected.map((i) => ({
        inboxId: i.id,
        fileName: i.file_name,
        pdfPath: i.file_path,
        testName: i.original_subject || i.file_name.replace(/\.pdf$/i, ""),
      }))
    );
    setBatchGrade("");
    setBatchSubject("");
    setBatchFolderId("");
    setBatchMode("separate");
    setShowBatchModal(true);
  };

  // 一括テスト作成実行
  const handleBatchCreate = async () => {
    if (!batchGrade || !batchSubject) {
      toast.error("学年と科目を選択してください");
      return;
    }
    setCreating(true);

    if (batchMode === "single") {
      // ---- 1テストとしてまとめて登録 ----
      try {
        const first = batchRows[0];
        const rest = batchRows.slice(1);
        const body: Record<string, unknown> = {
          name: first.testName,
          grade: batchGrade,
          subject: batchSubject,
          pdfPath: first.pdfPath,
          inboxItemId: first.inboxId,
          attachmentPaths: rest.map((r) => r.pdfPath),
          attachmentFileNames: rest.map((r) => r.fileName),
        };
        if (batchFolderId !== "") body.folderIds = [batchFolderId];
        const res = await fetch("/api/tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("作成失敗");
        // 全アイテムを assigned に更新
        await Promise.all(
          batchRows.map((row) =>
            fetch(`/api/inbox/${row.inboxId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "assigned" }),
            })
          )
        );
        setCreating(false);
        setShowBatchModal(false);
        setSelectedIds(new Set());
        toast.success(`1件のテスト（添付 ${rest.length} 件）を作成しました`);
      } catch {
        setCreating(false);
        toast.error("テストの作成に失敗しました");
      }
    } else {
      // ---- 別々のテストとして登録 ----
      let successCount = 0;
      let failCount = 0;
      for (const row of batchRows) {
        try {
          const body: Record<string, unknown> = {
            name: row.testName,
            grade: batchGrade,
            subject: batchSubject,
            pdfPath: row.pdfPath,
            inboxItemId: row.inboxId,
          };
          if (batchFolderId !== "") body.folderIds = [batchFolderId];
          const res = await fetch("/api/tests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error("作成失敗");
          await fetch(`/api/inbox/${row.inboxId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "assigned" }),
          });
          successCount++;
        } catch {
          failCount++;
        }
      }
      setCreating(false);
      setShowBatchModal(false);
      setSelectedIds(new Set());
      if (successCount > 0) toast.success(`${successCount} 件のテストを作成しました`);
      if (failCount > 0) toast.error(`${failCount} 件の作成に失敗しました`);
    }

    await fetchItems();
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
            <>
              <button
                onClick={handleOpenBatchModal}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
              >
                選択PDFからテスト作成 ({selectedIds.size}件)
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={deleting}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? "削除中..." : `選択削除 (${selectedIds.size}件)`}
              </button>
            </>
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

      {/* 一括テスト作成モーダル */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">一括テスト作成</h2>
              {batchRows.length > 1 && (
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                  <button
                    onClick={() => setBatchMode("separate")}
                    className={`px-3 py-1.5 transition-colors ${
                      batchMode === "separate" ? "bg-blue-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    別々のテスト
                  </button>
                  <button
                    onClick={() => setBatchMode("single")}
                    className={`px-3 py-1.5 transition-colors ${
                      batchMode === "single" ? "bg-blue-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    1つのテスト
                  </button>
                </div>
              )}
              <button
                onClick={() => setShowBatchModal(false)}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              {/* 共通設定 */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">学年 <span className="text-red-500">*</span></label>
                  <select
                    value={batchGrade}
                    onChange={(e) => setBatchGrade(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">選択してください</option>
                    {grades.map((g) => (
                      <option key={g.id} value={g.name}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">科目 <span className="text-red-500">*</span></label>
                  <select
                    value={batchSubject}
                    onChange={(e) => setBatchSubject(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">選択してください</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">フォルダ</label>
                  <select
                    value={batchFolderId}
                    onChange={(e) => setBatchFolderId(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">なし</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 各PDF のテスト名 */}
              {batchMode === "separate" ? (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-2">テスト名（個別に編集できます）</p>
                  <div className="space-y-2">
                    {batchRows.map((row, idx) => (
                      <div key={row.inboxId} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-5">{idx + 1}.</span>
                        <input
                          type="text"
                          value={row.testName}
                          onChange={(e) => {
                            const next = [...batchRows];
                            next[idx] = { ...next[idx], testName: e.target.value };
                            setBatchRows(next);
                          }}
                          className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="テスト名"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      テスト名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={batchRows[0]?.testName ?? ""}
                      onChange={(e) => {
                        const next = [...batchRows];
                        next[0] = { ...next[0], testName: e.target.value };
                        setBatchRows(next);
                      }}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="テスト名"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-1">
                      メインPDF: <span className="font-normal text-gray-500">{batchRows[0]?.fileName}</span>
                    </p>
                    {batchRows.length > 1 && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1">添付PDF（{batchRows.length - 1}件）:</p>
                        <ul className="text-xs text-gray-500 space-y-0.5 ml-2">
                          {batchRows.slice(1).map((row, idx) => (
                            <li key={row.inboxId}>• {idx + 1}. {row.fileName}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleBatchCreate}
                disabled={creating || !batchGrade || !batchSubject}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {creating
                  ? "作成中..."
                  : batchMode === "single"
                  ? `1件のテストとして作成（添付 ${batchRows.length - 1}件）`
                  : `${batchRows.length} 件を一括作成`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
