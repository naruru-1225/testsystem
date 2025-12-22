"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Sidebar from "./Sidebar";
import PdfViewer from "./PdfViewer";
import AdminModal from "./AdminModal";
import type { TestWithTags, TestAttachment, Tag } from "@/types/database";
import { useFolders } from "@/lib/hooks";
import { buildBreadcrumbs } from "@/lib/utils";

/**
 * テスト一覧コンポーネント
 * メイン画面のレイアウトとテスト一覧の表示
 */
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

  // フォルダデータを取得してパンくずリスト用に使用
  const { data: foldersData } = useFolders();
  const folders = foldersData || [];

  // パンくずリストを構築（useMemoでメモ化）
  const breadcrumbs = useMemo(() => {
    if (!selectedFolderId) return [];
    return buildBreadcrumbs(folders, selectedFolderId);
  }, [folders, selectedFolderId]);

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
      alert("テストの削除に失敗しました");
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
        </div>

        {/* テスト一覧テーブル */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">読み込み中...</div>
            ) : tests.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                テストが見つかりませんでした
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
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
                    {tests.map((test) => (
                      <tr
                        key={test.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm">
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
                              {test.name}
                            </button>
                          ) : (
                            <span className="text-gray-700">{test.name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{test.subject}</td>
                        <td className="px-4 py-3 text-sm">{test.grade}</td>
                        <td className="px-2 md:px-4 py-3 text-sm">
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
                        <td className="px-4 py-3">
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
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDate(test.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Link
                              href={`/tests/${test.id}/edit`}
                              className="text-primary hover:text-primary-dark text-sm font-medium"
                            >
                              編集
                            </Link>
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
        </div>
      </div>

      {/* PDFビューワー */}
      {pdfViewerOpen && selectedPdfUrl && selectedTest && (
        <PdfViewer
          pdfUrl={selectedPdfUrl}
          attachments={testAttachments}
          testName={selectedTest.name}
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
