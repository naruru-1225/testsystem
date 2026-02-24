"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

// ===========================
// テーマ設定（ダークモード・フォントサイズ）
// localStorageに保存され、デバイスごとに独立
// ===========================

type Theme = "light" | "dark" | "system";
type FontSize = "small" | "medium" | "large";

interface ThemeContextValue {
  theme: Theme;
  fontSize: FontSize;
  setTheme: (t: Theme) => void;
  setFontSize: (s: FontSize) => void;
  resetTheme: () => void;
  isDefault: boolean;
}

const THEME_KEY = "app-theme";
const FONT_SIZE_KEY = "app-font-size";
const DEFAULT_THEME: Theme = "system";
const DEFAULT_FONT_SIZE: FontSize = "medium";

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  fontSize: DEFAULT_FONT_SIZE,
  setTheme: () => {},
  setFontSize: () => {},
  resetTheme: () => {},
  isDefault: true,
});

/**
 * ダークモードとフォントサイズをlocalStorageで管理するプロバイダー
 * - <html>に `dark` クラスを付与してTailwindのdark:バリアントを有効化
 * - <html>にフォントサイズクラス(text-sm/text-base/text-lg)を付与
 * - デバイスごとに独立（localStorageを使用）
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [fontSize, setFontSizeState] = useState<FontSize>(DEFAULT_FONT_SIZE);

  // 初期化: localStorageから読み込み
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
    const savedFontSize = localStorage.getItem(FONT_SIZE_KEY) as FontSize | null;
    if (savedTheme) setThemeState(savedTheme);
    if (savedFontSize) setFontSizeState(savedFontSize);
  }, []);

  // ダークモードの適用
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = theme === "dark" || (theme === "system" && prefersDark);

    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // フォントサイズの適用
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("font-small", "font-medium", "font-large");
    root.classList.add(`font-${fontSize}`);
  }, [fontSize]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
  }, []);

  const setFontSize = useCallback((s: FontSize) => {
    setFontSizeState(s);
    localStorage.setItem(FONT_SIZE_KEY, s);
  }, []);

  const resetTheme = useCallback(() => {
    setTheme(DEFAULT_THEME);
    setFontSize(DEFAULT_FONT_SIZE);
    localStorage.removeItem(THEME_KEY);
    localStorage.removeItem(FONT_SIZE_KEY);
  }, [setTheme, setFontSize]);

  const isDefault = theme === DEFAULT_THEME && fontSize === DEFAULT_FONT_SIZE;

  return (
    <ThemeContext.Provider value={{ theme, fontSize, setTheme, setFontSize, resetTheme, isDefault }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

/**
 * テーマ切替パネル（サイドバーや設定画面に埋め込み可能）
 */
export function ThemeTogglePanel() {
  const { theme, fontSize, setTheme, setFontSize, resetTheme, isDefault } = useTheme();

  return (
    <div className="space-y-3 text-sm">
      {/* ダークモード */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          カラーテーマ
        </p>
        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          {(["light", "system", "dark"] as Theme[]).map((t, i) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`flex-1 py-1.5 text-xs transition-colors ${i > 0 ? "border-l border-gray-300 dark:border-gray-600" : ""} ${
                theme === t
                  ? "bg-primary text-white"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {t === "light" ? "☀️ ライト" : t === "dark" ? "🌙 ダーク" : "💻 システム"}
            </button>
          ))}
        </div>
      </div>

      {/* フォントサイズ */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          文字サイズ
        </p>
        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          {(["small", "medium", "large"] as FontSize[]).map((s, i) => (
            <button
              key={s}
              onClick={() => setFontSize(s)}
              className={`flex-1 py-1.5 text-xs transition-colors ${i > 0 ? "border-l border-gray-300 dark:border-gray-600" : ""} ${
                fontSize === s
                  ? "bg-primary text-white"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {s === "small" ? "小" : s === "medium" ? "中" : "大"}
            </button>
          ))}
        </div>
      </div>

      {/* 標準表示に戻す */}
      {!isDefault && (
        <button
          onClick={resetTheme}
          className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          標準表示に戻す
        </button>
      )}
    </div>
  );
}
