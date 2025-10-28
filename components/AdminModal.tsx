'use client';

import { useState, useEffect } from 'react';
import type { Folder, Tag } from '@/types/database';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

type TabType = 'folders' | 'tags' | 'restore';

export default function AdminModal({ isOpen, onClose, onUpdate }: AdminModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('folders');
  
  // フォルダ関連
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<number | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<number | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [editingFolderParentId, setEditingFolderParentId] = useState<number | null>(null);
  
  // タグ関連
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editingTagColor, setEditingTagColor] = useState('');
  
  // バックアップ復元関連
  const [backupTests, setBackupTests] = useState<any[]>([]);
  const [selectedTests, setSelectedTests] = useState<Set<number>>(new Set());
  const [backupLoading, setBackupLoading] = useState(false);
  
  // UI状態
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 定義済みカラーパレット
  const colorPalette = [
    '#3B82F6', // 青
    '#10B981', // 緑
    '#EF4444', // 赤
    '#8B5CF6', // 紫
    '#F59E0B', // オレンジ
    '#EC4899', // ピンク
    '#6366F1', // インディゴ
    '#14B8A6', // ティール
  ];

  useEffect(() => {
    if (isOpen) {
      fetchFolders();
      fetchTags();
    }
  }, [isOpen]);

  const fetchFolders = async () => {
    try {
      const response = await fetch('/api/folders');
      if (!response.ok) throw new Error('フォルダの取得に失敗しました');
      const data = await response.json();
      setFolders(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await fetch('/api/tags');
      if (!response.ok) throw new Error('タグの取得に失敗しました');
      const data = await response.json();
      setTags(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // フォルダ作成
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setError('フォルダ名を入力してください');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newFolderName.trim(),
          parentId: newFolderParentId 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'フォルダの作成に失敗しました');
      }

      setSuccess('フォルダを作成しました');
      setNewFolderName('');
      setNewFolderParentId(null);
      await fetchFolders();
      onUpdate();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // フォルダ更新
  const handleUpdateFolder = async (id: number) => {
    if (!editingFolderName.trim()) {
      setError('フォルダ名を入力してください');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/folders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: editingFolderName.trim(),
          parentId: editingFolderParentId 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'フォルダの更新に失敗しました');
      }

      setSuccess('フォルダを更新しました');
      setEditingFolderId(null);
      setEditingFolderName('');
      setEditingFolderParentId(null);
      await fetchFolders();
      onUpdate();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // フォルダ削除
  const handleDeleteFolder = async (id: number, name: string) => {
    // 「未分類」フォルダは削除不可
    if (name === '未分類') {
      setError('「未分類」フォルダは削除できません');
      return;
    }
    
    if (!confirm(`「${name}」を削除してもよろしいですか？`)) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/folders/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'フォルダの削除に失敗しました');
      }

      setSuccess('フォルダを削除しました');
      await fetchFolders();
      onUpdate();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // タグ作成
  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      setError('タグ名を入力してください');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'タグの作成に失敗しました');
      }

      setSuccess('タグを作成しました');
      setNewTagName('');
      setNewTagColor('#3B82F6');
      await fetchTags();
      onUpdate();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // タグ更新
  const handleUpdateTag = async (id: number) => {
    if (!editingTagName.trim()) {
      setError('タグ名を入力してください');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tags/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingTagName.trim(), color: editingTagColor }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'タグの更新に失敗しました');
      }

      setSuccess('タグを更新しました');
      setEditingTagId(null);
      setEditingTagName('');
      setEditingTagColor('');
      await fetchTags();
      onUpdate();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // タグ削除
  const handleDeleteTag = async (id: number, name: string) => {
    if (!confirm(`「${name}」を削除してもよろしいですか？`)) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tags/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'タグの削除に失敗しました');
      }

      setSuccess('タグを削除しました');
      await fetchTags();
      onUpdate();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // バックアップファイル読み込み
  const handleBackupFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBackupLoading(true);
    setError(null);
    setSuccess(null);
    setBackupTests([]);
    setSelectedTests(new Set());

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/backup/restore', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'バックアップファイルの読み込みに失敗しました');
      }

      const data = await response.json();
      setBackupTests(data.tests);
      setSuccess(`${data.count}件のテストを読み込みました`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBackupLoading(false);
    }
  };

  // テストを復元
  const handleRestoreTests = async () => {
    if (selectedTests.size === 0) {
      setError('復元するテストを選択してください');
      return;
    }

    if (!confirm(`選択した${selectedTests.size}件のテストを復元しますか？`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const testId of selectedTests) {
        const test = backupTests.find(t => t.id === testId);
        if (!test) continue;

        try {
          const response = await fetch('/api/backup/restore-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ test }),
          });

          if (response.ok) {
            successCount++;
          } else {
            const errorData = await response.json();
            errors.push(`${test.name}: ${errorData.error}`);
            errorCount++;
          }
        } catch (err: any) {
          errors.push(`${test.name}: ${err.message}`);
          errorCount++;
        }
      }

      if (successCount > 0) {
        setSuccess(`${successCount}件のテストを復元しました`);
        onUpdate();
        setSelectedTests(new Set());
        // 復元したテストをリストから削除
        setBackupTests(backupTests.filter(t => !selectedTests.has(t.id)));
      }

      if (errorCount > 0) {
        setError(`${errorCount}件の復元に失敗しました:\n${errors.join('\n')}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // テスト選択トグル
  const toggleTestSelection = (testId: number) => {
    const newSelected = new Set(selectedTests);
    if (newSelected.has(testId)) {
      newSelected.delete(testId);
    } else {
      newSelected.add(testId);
    }
    setSelectedTests(newSelected);
  };

  // 全選択/解除
  const toggleAllTests = () => {
    if (selectedTests.size === backupTests.length) {
      setSelectedTests(new Set());
    } else {
      setSelectedTests(new Set(backupTests.map(t => t.id)));
    }
  };

  // バックアップ作成
  const handleCreateBackup = async () => {
    try {
      setError(null);
      setSuccess(null);

      // バックアップファイルをダウンロード
      const response = await fetch('/api/backup/create');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'バックアップの作成に失敗しました');
      }

      // ファイルをダウンロード
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // ファイル名を取得(レスポンスヘッダーから)
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `backup-${new Date().toISOString()}.db`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess('バックアップを作成しました');
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">管理者メニュー</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* タブ */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('folders')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'folders'
                ? 'text-primary border-b-2 border-primary bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            フォルダ管理
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'tags'
                ? 'text-primary border-b-2 border-primary bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            タグ管理
          </button>
          <button
            onClick={() => setActiveTab('restore')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'restore'
                ? 'text-primary border-b-2 border-primary bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            バックアップ復元
          </button>
        </div>

        {/* メッセージ */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {success}
          </div>
        )}

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'folders' && (
            <div className="space-y-6">
              {/* フォルダ作成 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">新規フォルダ作成</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="フォルダ名を入力"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loading}
                    maxLength={50}
                  />
                  <select
                    value={newFolderParentId || ''}
                    onChange={(e) => setNewFolderParentId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loading}
                  >
                    <option value="">親フォルダなし(ルート)</option>
                    {folders.filter(f => f.id !== 1).map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleCreateFolder}
                    disabled={loading || !newFolderName.trim()}
                    className="w-full px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    作成
                  </button>
                </div>
              </div>

              {/* フォルダ一覧 */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">フォルダ一覧</h3>
                <div className="space-y-2">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {editingFolderId === folder.id ? (
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={editingFolderName}
                            onChange={(e) => setEditingFolderName(e.target.value)}
                            className="w-full px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                            disabled={loading}
                            maxLength={50}
                          />
                          <select
                            value={editingFolderParentId || ''}
                            onChange={(e) => setEditingFolderParentId(e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                            disabled={loading}
                          >
                            <option value="">親フォルダなし(ルート)</option>
                            {folders.filter(f => f.id !== 1 && f.id !== folder.id).map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateFolder(folder.id)}
                              disabled={loading}
                              className="px-3 py-1 bg-primary hover:bg-primary-dark text-white text-sm rounded transition-colors disabled:opacity-50"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => {
                                setEditingFolderId(null);
                                setEditingFolderName('');
                                setEditingFolderParentId(null);
                              }}
                              disabled={loading}
                              className="px-3 py-1 bg-gray-300 hover:bg-gray-400 text-gray-700 text-sm rounded transition-colors disabled:opacity-50"
                            >
                              キャンセル
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <span className="text-gray-900 font-medium">{folder.name}</span>
                            {folder.parent_id && (
                              <span className="ml-2 text-sm text-gray-500">
                                ({folders.find(f => f.id === folder.parent_id)?.name})
                              </span>
                            )}
                          </div>
                          {folder.id !== 1 && folder.name !== '未分類' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditingFolderId(folder.id);
                                  setEditingFolderName(folder.name);
                                  setEditingFolderParentId(folder.parent_id);
                                  setError(null);
                                  setSuccess(null);
                                }}
                                disabled={loading}
                                className="px-3 py-1 text-primary hover:bg-blue-50 text-sm rounded transition-colors disabled:opacity-50"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => handleDeleteFolder(folder.id, folder.name)}
                                disabled={loading}
                                className="px-3 py-1 text-red-600 hover:bg-red-50 text-sm rounded transition-colors disabled:opacity-50"
                              >
                                削除
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tags' && (
            <div className="space-y-6">
              {/* タグ作成 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">新規タグ作成</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="タグ名を入力"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loading}
                    maxLength={20}
                  />
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-700">色:</span>
                    <div className="flex gap-2">
                      {colorPalette.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewTagColor(color)}
                          className={`w-8 h-8 rounded-full transition-all ${
                            newTagColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                          }`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleCreateTag}
                    disabled={loading || !newTagName.trim()}
                    className="w-full px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    作成
                  </button>
                </div>
              </div>

              {/* タグ一覧 */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">タグ一覧</h3>
                <div className="space-y-2">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {editingTagId === tag.id ? (
                        <>
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              value={editingTagName}
                              onChange={(e) => setEditingTagName(e.target.value)}
                              className="w-full px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                              disabled={loading}
                              maxLength={20}
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-700">色:</span>
                              {colorPalette.map((color) => (
                                <button
                                  key={color}
                                  onClick={() => setEditingTagColor(color)}
                                  className={`w-6 h-6 rounded-full transition-all ${
                                    editingTagColor === color ? 'ring-2 ring-offset-1 ring-gray-400' : ''
                                  }`}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2 ml-3">
                            <button
                              onClick={() => handleUpdateTag(tag.id)}
                              disabled={loading}
                              className="px-3 py-1 bg-primary hover:bg-primary-dark text-white text-sm rounded transition-colors disabled:opacity-50"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => {
                                setEditingTagId(null);
                                setEditingTagName('');
                                setEditingTagColor('');
                              }}
                              disabled={loading}
                              className="px-3 py-1 bg-gray-300 hover:bg-gray-400 text-gray-700 text-sm rounded transition-colors disabled:opacity-50"
                            >
                              キャンセル
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <div
                              className="w-6 h-6 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span className="text-gray-900 font-medium">{tag.name}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingTagId(tag.id);
                                setEditingTagName(tag.name);
                                setEditingTagColor(tag.color);
                                setError(null);
                                setSuccess(null);
                              }}
                              disabled={loading}
                              className="px-3 py-1 text-primary hover:bg-blue-50 text-sm rounded transition-colors disabled:opacity-50"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => handleDeleteTag(tag.id, tag.name)}
                              disabled={loading}
                              className="px-3 py-1 text-red-600 hover:bg-red-50 text-sm rounded transition-colors disabled:opacity-50"
                            >
                              削除
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'restore' && (
            <div className="space-y-6">
              {/* バックアップ作成 */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">バックアップ作成</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      現在のデータベースをバックアップファイルとして保存します。定期的にバックアップを作成することをお勧めします。
                    </p>
                  </div>
                  <button
                    onClick={handleCreateBackup}
                    disabled={loading}
                    className="ml-4 px-6 py-2 bg-primary hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    バックアップ作成
                  </button>
                </div>
              </div>

              {/* バックアップファイル選択 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">バックアップから復元</h3>
                <p className="text-sm text-gray-600 mb-3">
                  誤って削除したテストを復元できます。バックアップファイル(.db)を選択してください。
                </p>
                <input
                  type="file"
                  accept=".db"
                  onChange={handleBackupFileSelect}
                  disabled={backupLoading || loading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              {/* 復元対象のテストリスト */}
              {backupTests.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">
                      バックアップ内のテスト ({backupTests.length}件)
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={toggleAllTests}
                        disabled={loading}
                        className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                      >
                        {selectedTests.size === backupTests.length ? '全解除' : '全選択'}
                      </button>
                      <button
                        onClick={handleRestoreTests}
                        disabled={loading || selectedTests.size === 0}
                        className="px-4 py-1 text-sm bg-primary hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        選択したテストを復元 ({selectedTests.size})
                      </button>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                    {backupTests.map((test) => (
                      <div
                        key={test.id}
                        className="p-4 hover:bg-gray-50 transition-colors"
                      >
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedTests.has(test.id)}
                            onChange={() => toggleTestSelection(test.id)}
                            disabled={loading}
                            className="mt-1 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900">{test.name}</span>
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                {test.subject}
                              </span>
                              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                                {test.grade}
                              </span>
                            </div>
                            {test.description && (
                              <p className="text-sm text-gray-600 mb-2">{test.description}</p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>📁 {test.folder_name || '未分類'}</span>
                              {test.tags && test.tags.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <span>🏷️</span>
                                  {test.tags.map((tag: any) => (
                                    <span
                                      key={tag.id}
                                      className="px-2 py-0.5 rounded text-white"
                                      style={{ backgroundColor: tag.color }}
                                    >
                                      {tag.name}
                                    </span>
                                  ))}
                                </span>
                              )}
                              {test.created_at && (
                                <span>
                                  作成日: {new Date(test.created_at).toLocaleDateString('ja-JP')}
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {backupTests.length === 0 && !backupLoading && (
                <div className="text-center py-12 text-gray-500">
                  バックアップファイルを選択してください
                </div>
              )}

              {backupLoading && (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="mt-2 text-gray-600">読み込み中...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
