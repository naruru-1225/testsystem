'use client';

import { useState, useEffect } from 'react';
import type { Folder } from '@/types/database';

/**
 * サイドバーコンポーネント
 * フォルダ一覧、カテゴリ、管理者メニューを表示
 */
interface SidebarProps {
  onFolderSelect: (folderId: number | null) => void;
  selectedFolderId: number | null;
  onCategorySelect: (grade: string | null, subject: string | null) => void;
  selectedCategory: { grade: string | null; subject: string | null } | null;
  onAdminMenuClick: () => void;
  refreshTrigger?: number; // カテゴリ再取得のトリガー
}

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
  const [folders, setFolders] = useState<Folder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set());

  // フォルダ一覧とカテゴリの取得
  useEffect(() => {
    fetchFolders();
    fetchCategories();
  }, []);

  // refreshTriggerが変更されたらカテゴリを再取得
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      fetchCategories();
    }
  }, [refreshTrigger]);

  const fetchFolders = async () => {
    try {
      const response = await fetch("/api/folders");
      if (!response.ok) throw new Error("フォルダの取得に失敗しました");
      const data = await response.json();
      setFolders(data);
    } catch (error) {
      console.error("フォルダ取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("カテゴリの取得に失敗しました");
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error("カテゴリ取得エラー:", error);
    }
  };

  // フォルダの展開/折りたたみ切り替え
  const toggleFolder = (folderId: number) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  // 学年の展開/折りたたみ切り替え
  const toggleGrade = (grade: string) => {
    const newExpanded = new Set(expandedGrades);
    if (newExpanded.has(grade)) {
      newExpanded.delete(grade);
    } else {
      newExpanded.add(grade);
    }
    setExpandedGrades(newExpanded);
  };

  // 階層構造を構築する関数
  const buildFolderTree = () => {
    const rootFolders = folders.filter(f => !f.parent_id);
    const childMap = new Map<number, Folder[]>();
    
    // 子フォルダをマッピング
    folders.forEach(folder => {
      if (folder.parent_id) {
        if (!childMap.has(folder.parent_id)) {
          childMap.set(folder.parent_id, []);
        }
        childMap.get(folder.parent_id)!.push(folder);
      }
    });

    return { rootFolders, childMap };
  };

  // フォルダアイテムを再帰的にレンダリング
  const renderFolder = (folder: Folder, level: number = 0, childMap: Map<number, Folder[]>) => {
    const hasChildren = childMap.has(folder.id);
    const isExpanded = expandedFolders.has(folder.id);
    const children = childMap.get(folder.id) || [];

    return (
      <div key={folder.id}>
        <div className="flex items-center">
          {/* 展開/折りたたみボタン */}
          {hasChildren && (
            <button
              onClick={() => toggleFolder(folder.id)}
              className="p-1 hover:bg-blue-600 rounded"
            >
              <svg
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
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
              console.log('Folder clicked:', folder.id, folder.name);
              onFolderSelect(folder.id);
            }}
            className={`flex-1 text-left px-2 py-1.5 rounded transition-colors flex items-center gap-2 ${
              !hasChildren ? 'ml-5' : ''
            } ${
              (folder.id === 1 && selectedFolderId === null && !selectedCategory?.grade) ||
              (folder.id !== 1 && selectedFolderId === folder.id)
                ? "bg-sidebar-dark"
                : "hover:bg-blue-600"
            }`}
            style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
          >
            <svg
              className="w-5 h-5 flex-shrink-0"
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
            <span className="break-words">{folder.name}</span>
          </button>
        </div>
        
        {/* 子フォルダ */}
        {hasChildren && isExpanded && (
          <div>
            {children.map(child => renderFolder(child, level + 1, childMap))}
          </div>
        )}
      </div>
    );
  };

  const { rootFolders, childMap } = buildFolderTree();

  return (
    <div className="w-full md:w-64 bg-sidebar text-white h-screen flex flex-col overflow-hidden">
      {/* ヘッダー */}
      <div className="p-3 border-b border-sidebar-dark flex-shrink-0">
        <div className="flex items-center gap-2">
          <img 
            src="/logo.png" 
            alt="ロゴ" 
            className="w-7 h-7 object-contain flex-shrink-0"
            onError={(e) => {
              // 画像読み込みエラー時は非表示
              e.currentTarget.style.display = 'none';
            }}
          />
          <h1 className="text-base font-bold break-words flex-1">テスト管理システム</h1>
        </div>
      </div>

      {/* カテゴリ一覧 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-1">
          <h2 className="text-sm font-semibold px-2 py-1.5 text-blue-100">
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
                            isGradeExpanded ? 'rotate-90' : ''
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
                      className={`flex-1 text-left px-2 py-1.5 rounded transition-colors flex items-center gap-2 ${
                        !hasSubjects ? 'ml-5' : ''
                      } ${
                        selectedCategory?.grade === category.grade && !selectedCategory?.subject
                          ? "bg-sidebar-dark"
                          : "hover:bg-blue-600"
                      }`}
                    >
                      <svg
                        className="w-5 h-5 flex-shrink-0"
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
                          className={`w-full text-left px-2 py-1.5 rounded transition-colors flex items-center gap-2 ml-5 ${
                            selectedCategory?.grade === category.grade && selectedCategory?.subject === subject
                              ? "bg-sidebar-dark"
                              : "hover:bg-blue-600"
                          }`}
                        >
                          <svg
                            className="w-5 h-5 flex-shrink-0"
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

        {/* フォルダ一覧 */}
        <div className="p-1 border-t border-sidebar-dark mt-1">
          <h2 className="text-sm font-semibold px-2 py-1.5 text-blue-100">
            フォルダ一覧
          </h2>
          {loading ? (
            <div className="px-2 py-1.5 text-sm">読み込み中...</div>
          ) : (
            <div className="space-y-0.5">
              {rootFolders.map((folder) => renderFolder(folder, 0, childMap))}
            </div>
          )}
        </div>
      </div>

      {/* 管理者メニュー */}
      <div className="p-2 border-t border-sidebar-dark flex-shrink-0">
        <button 
          onClick={onAdminMenuClick}
          className="w-full text-left px-2 py-1.5 rounded hover:bg-blue-600 transition-colors flex items-center gap-2"
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
