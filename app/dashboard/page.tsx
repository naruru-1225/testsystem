"use client";

import { useStatsSummary } from "@/lib/hooks";
import Link from "next/link";

/**
 * ダッシュボードページ
 * システム全体の統計情報を表示
 */
/**
 * ダッシュボードページ
 *
 * @description
 * システム全体の統計情報を表示するダッシュボード:
 * - 5つの主要指標カード
 * - 学年別・科目別テスト分布グラフ
 * - タグ使用頻度ランキング
 * - フォルダ別テスト数ランキング
 * - 最近追加されたテスト一覧
 */
export default function DashboardPage() {
  const { data: stats, loading, error } = useStatsSummary();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">統計情報の取得に失敗しました</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
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
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              テスト一覧に戻る
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
          <div className="w-32"></div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 概要カード */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                <svg
                  className="h-6 w-6 text-white"
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
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    総テスト数
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {stats.overview.totalTests}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                <svg
                  className="h-6 w-6 text-white"
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
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    フォルダ数
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {stats.overview.totalFolders}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    タグ数
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {stats.overview.totalTags}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-red-500 rounded-md p-3">
                <svg
                  className="h-6 w-6 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    PDF添付あり
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {stats.overview.testsWithPdf}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-gray-500 rounded-md p-3">
                <svg
                  className="h-6 w-6 text-white"
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
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    PDF添付なし
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {stats.overview.testsWithoutPdf}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 学年別テスト数 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                学年別テスト数
              </h2>
            </div>
            <div className="p-6">
              {stats.testsByGrade.length === 0 ? (
                <p className="text-gray-500 text-center">データがありません</p>
              ) : (
                <div className="space-y-3">
                  {stats.testsByGrade.map((item) => (
                    <div
                      key={item.grade}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm font-medium text-gray-700">
                        {item.grade}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-48 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{
                              width: `${
                                (item.count / stats.overview.totalTests) * 100
                              }%`,
                            }}
                          ></div>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 w-12 text-right">
                          {item.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 科目別テスト数 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                科目別テスト数
              </h2>
            </div>
            <div className="p-6">
              {stats.testsBySubject.length === 0 ? (
                <p className="text-gray-500 text-center">データがありません</p>
              ) : (
                <div className="space-y-3">
                  {stats.testsBySubject.map((item) => (
                    <div
                      key={item.subject}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm font-medium text-gray-700">
                        {item.subject}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-48 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{
                              width: `${
                                (item.count / stats.overview.totalTests) * 100
                              }%`,
                            }}
                          ></div>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 w-12 text-right">
                          {item.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* タグ使用頻度トップ10 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                タグ使用頻度 TOP10
              </h2>
            </div>
            <div className="p-6">
              {stats.topTags.length === 0 ? (
                <p className="text-gray-500 text-center">データがありません</p>
              ) : (
                <div className="space-y-2">
                  {stats.topTags.map((tag, index) => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 w-6">
                          {index + 1}
                        </span>
                        <span
                          className="px-2 py-1 text-xs rounded"
                          style={{ backgroundColor: tag.color, color: "#fff" }}
                        >
                          {tag.name}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {tag.usage_count}回
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* フォルダ別テスト数トップ10 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                フォルダ別テスト数 TOP10
              </h2>
            </div>
            <div className="p-6">
              {stats.testsByFolder.length === 0 ? (
                <p className="text-gray-500 text-center">データがありません</p>
              ) : (
                <div className="space-y-2">
                  {stats.testsByFolder.map((folder, index) => (
                    <div
                      key={folder.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 w-6">
                          {index + 1}
                        </span>
                        <svg
                          className="w-4 h-4 text-blue-500"
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
                        <span className="text-sm text-gray-700">
                          {folder.name}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {folder.count}件
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 最近追加されたテスト */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              最近追加されたテスト
            </h2>
          </div>
          <div className="overflow-x-auto">
            {stats.recentTests.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                データがありません
              </p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      テスト名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      科目
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      学年
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      フォルダ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      追加日時
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.recentTests.map((test) => (
                    <tr key={test.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {test.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {test.subject}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {test.grade}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {test.folder_name || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(test.created_at).toLocaleString("ja-JP")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          href={`/tests/${test.id}/edit`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          詳細
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
