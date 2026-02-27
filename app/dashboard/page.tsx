"use client";

import { useStatsSummary } from "@/lib/hooks";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

// localStorage キーでウィジェット表示設定を管理 (#66)
const WIDGET_PREF_KEY = "dashboard-widget-prefs";
type WidgetKey = "grade" | "subject" | "tags" | "folders" | "trend" | "coverage" | "recent";
const ALL_WIDGETS: { key: WidgetKey; label: string }[] = [
  { key: "grade", label: "学年別テスト数" },
  { key: "subject", label: "科目別テスト数" },
  { key: "tags", label: "タグ使用頻度" },
  { key: "folders", label: "フォルダ別テスト数" },
  { key: "trend", label: "登録推移グラフ" },
  { key: "coverage", label: "学年×科目カバレッジ" },
  { key: "recent", label: "最近追加されたテスト" },
];

export default function DashboardPage() {
  const { data: stats, loading, error } = useStatsSummary();

  // ウィジェット表示設定 (#66)
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<WidgetKey>>(new Set());
  const [showWidgetSettings, setShowWidgetSettings] = useState(false);

  // 期間フィルター (#62)
  const PERIOD_OPTIONS = [
    { label: "直近30日", days: 30 },
    { label: "直近7日", days: 7 },
    { label: "今月", days: -1 },
    { label: "今年度", days: -2 },
    { label: "全期間", days: 0 },
  ];
  const [periodDays, setPeriodDays] = useState(30);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(WIDGET_PREF_KEY);
    if (saved) {
      try {
        setHiddenWidgets(new Set(JSON.parse(saved)));
      } catch {
        // ignore
      }
    }
  }, []);

  const toggleWidget = (key: WidgetKey) => {
    setHiddenWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem(WIDGET_PREF_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  // 期間フィルター適用 (#62)
  const filteredRecentTests = useMemo(() => {
    if (!stats?.recentTests) return [];
    if (periodDays === 0) return stats.recentTests;
    const now = new Date();
    let cutoff: Date;
    if (periodDays === -1) {
      cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (periodDays === -2) {
      const fiscalStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      cutoff = new Date(fiscalStart, 3, 1);
    } else {
      cutoff = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    }
    return stats.recentTests.filter((t) => new Date(t.created_at) >= cutoff);
  }, [stats?.recentTests, periodDays]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">読み込み中...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-red-500">データの読み込みに失敗しました</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ヘッダー */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                テスト一覧
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ダッシュボード</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* CSV ダウンロード (#67) */}
              <a
                href="/api/export/tests?format=csv"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                CSVダウンロード
              </a>
              {/* ウィジェット設定 (#66) */}
              <button
                onClick={() => setShowWidgetSettings((v) => !v)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                表示設定
              </button>
            </div>
          </div>
          {/* ウィジェット表示/非表示設定パネル (#66) */}
          {showWidgetSettings && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">表示するウィジェットを選択</p>
              <div className="flex flex-wrap gap-2">
                {ALL_WIDGETS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => toggleWidget(key)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      hiddenWidgets.has(key)
                        ? "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-500 text-gray-400 dark:text-gray-500"
                        : "bg-blue-600 border-blue-600 text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 概要カード */}
        {(() => {
          const todayStr = new Date().toISOString().slice(0, 10);
          const todayCount = stats.registrationTrend?.find(d => d.date === todayStr)?.count ?? 0;
          const weekCount = stats.registrationTrend?.slice(-7).reduce((acc, d) => acc + d.count, 0) ?? 0;
          const cards = [
            { label: "総テスト数", value: stats.overview.totalTests, color: "bg-blue-500", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
            { label: "今日追加", value: todayCount, color: "bg-indigo-500", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
            { label: "今週追加", value: weekCount, color: "bg-cyan-500", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
            { label: "タグ数", value: stats.overview.totalTags, color: "bg-purple-500", icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" },
            { label: "フォルダ数", value: stats.overview.totalFolders, color: "bg-yellow-500", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" },
            { label: "PDF添付あり", value: stats.overview.testsWithPdf, color: "bg-red-500", icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" },
            { label: "ストレージ", value: stats.storageUsage?.formatted ?? "---", color: "bg-orange-500", icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" },
          ];
          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              {cards.map(({ label, value, color, icon }) => (
                <div key={label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center gap-3">
                  <div className={`${color} rounded-lg p-2 flex-shrink-0`}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* 登録推移グラフ (#63) */}
        {!hiddenWidgets.has("trend") && stats.registrationTrend && stats.registrationTrend.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">登録推移（直近30日）</h2>
            <div className="flex items-end gap-0.5 h-32">
              {stats.registrationTrend.map((d) => {
                const maxCount = Math.max(...stats.registrationTrend!.map((x) => x.count), 1);
                const heightPct = (d.count / maxCount) * 100;
                return (
                  <div key={d.date} className="flex-1 group relative" title={`${d.date}: ${d.count}件`}>
                    <div
                      className="bg-blue-400 dark:bg-blue-500 rounded-t hover:bg-blue-600 dark:hover:bg-blue-400 transition-colors cursor-default"
                      style={{ height: `${Math.max(heightPct, d.count > 0 ? 4 : 0)}%` }}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 bg-gray-900 text-white text-xs rounded px-1.5 py-0.5 whitespace-nowrap">
                      {d.date.slice(5)}: {d.count}件
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>{stats.registrationTrend[0]?.date.slice(5)}</span>
              <span>{stats.registrationTrend[stats.registrationTrend.length - 1]?.date.slice(5)}</span>
            </div>
          </div>
        )}

        {/* 学年×科目カバレッジ (#64) */}
        {!hiddenWidgets.has("coverage") && stats.subjectCoverage && stats.subjectCoverage.length > 0 && (() => {
          const grades = [...new Set(stats.subjectCoverage!.map((x) => x.grade))].sort();
          const subjects = [...new Set(stats.subjectCoverage!.map((x) => x.subject))].sort();
          const coverageMap = new Map(stats.subjectCoverage!.map((x) => [`${x.grade}__${x.subject}`, x.count]));
          return (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 overflow-x-auto">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">学年×科目カバレッジ</h2>
              <table className="text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="border border-gray-200 dark:border-gray-600 px-3 py-1 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-left">学年</th>
                    {subjects.map((s) => (
                      <th key={s} className="border border-gray-200 dark:border-gray-600 px-3 py-1 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-center whitespace-nowrap">{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grades.map((g) => (
                    <tr key={g}>
                      <td className="border border-gray-200 dark:border-gray-600 px-3 py-1 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{g}</td>
                      {subjects.map((s) => {
                        const cnt = coverageMap.get(`${g}__${s}`);
                        return (
                          <td key={s} className="border border-gray-200 dark:border-gray-600 px-3 py-1 text-center">
                            {cnt ? (
                              <span className="inline-block bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-semibold px-1.5 py-0.5 rounded">{cnt}</span>
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* 期間フィルター + 最近追加されたテスト (#62) */}
        {!hiddenWidgets.has("recent") && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">最近追加されたテスト</h2>
              <div className="flex gap-1 flex-wrap">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.days}
                    onClick={() => setPeriodDays(opt.days)}
                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                      periodDays === opt.days
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {filteredRecentTests.length === 0 ? (
              <p className="text-gray-400 dark:text-gray-500 text-sm">この期間のテストはありません</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredRecentTests.slice(0, 10).map((test) => (
                  <div key={test.id} className="py-2 flex items-center justify-between">
                    <div className="min-w-0">
                      <Link
                        href={`/tests/${test.id}`}
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate block"
                      >
                        {test.name}
                      </Link>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {test.subject} / {test.grade}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 flex-shrink-0">
                      {new Date(test.created_at).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 学年別テスト数 */}
          {!hiddenWidgets.has("grade") && stats.testsByGrade && stats.testsByGrade.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">学年別テスト数</h2>
              <div className="space-y-2">
                {stats.testsByGrade.map((item) => {
                  const max = Math.max(...stats.testsByGrade.map((x) => x.count));
                  const pct = max > 0 ? (item.count / max) * 100 : 0;
                  return (
                    <div key={item.grade} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 dark:text-gray-400 w-20 flex-shrink-0 truncate">{(item as { grade: string; count: number }).grade}</span>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                        <div className="bg-blue-500 h-4 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-8 text-right">{item.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 科目別テスト数 */}
          {!hiddenWidgets.has("subject") && stats.testsBySubject && stats.testsBySubject.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">科目別テスト数</h2>
              <div className="space-y-2">
                {stats.testsBySubject.map((item) => {
                  const max = Math.max(...stats.testsBySubject.map((x) => x.count));
                  const pct = max > 0 ? (item.count / max) * 100 : 0;
                  return (
                    <div key={item.subject} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 dark:text-gray-400 w-20 flex-shrink-0 truncate">{(item as { subject: string; count: number }).subject}</span>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                        <div className="bg-purple-500 h-4 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-8 text-right">{item.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* タグ使用頻度 */}
          {!hiddenWidgets.has("tags") && stats.topTags && stats.topTags.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">タグ使用頻度</h2>
              <div className="flex flex-wrap gap-2">
                {stats.topTags.map((tag) => (
                  <span
                    key={tag.name}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs"
                  >
                    {tag.name}
                    <span className="bg-blue-200 dark:bg-blue-700 text-blue-900 dark:text-blue-100 rounded-full px-1.5 text-xs font-bold">
                      {tag.usage_count}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* フォルダ別テスト数 */}
          {!hiddenWidgets.has("folders") && stats.testsByFolder && stats.testsByFolder.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">フォルダ別テスト数</h2>
              <div className="space-y-2">
                {stats.testsByFolder.slice(0, 8).map((item) => {
                  const max = Math.max(...stats.testsByFolder.map((x) => x.count));
                  const pct = max > 0 ? (item.count / max) * 100 : 0;
                  return (
                    <div key={(item as { id: number; name: string; count: number }).name} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 dark:text-gray-400 w-20 flex-shrink-0 truncate">{(item as { id: number; name: string; count: number }).name}</span>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                        <div className="bg-yellow-500 h-4 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-8 text-right">{item.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}