'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Folder, Tag, TestWithTags } from '@/types/database';

/**
 * テスト編集フォームコンポーネント
 * 既存テストの編集画面
 */
interface TestEditFormProps {
  testId: number;
}

export default function TestEditForm({ testId }: TestEditFormProps) {
  const router = useRouter();
  
  // フォーム入力値
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([1]); // 複数選択対応
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [description, setDescription] = useState('');
  const [totalQuestions, setTotalQuestions] = useState<string>('');
  const [totalScore, setTotalScore] = useState<string>('');

  // マスターデータ
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  // UI状態
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 科目と学年の選択肢
  const subjects = ['数学', '英語', '国語', '理科', '社会'];
  const grades = ['中1', '中2', '中3', '高1', '高2', '高3'];

  // フォルダを階層的に並べ替える関数
  const buildFolderHierarchy = () => {
    const folderMap = new Map<number, Folder>();
    const rootFolders: Folder[] = [];
    
    // マップを作成
    folders.forEach(folder => {
      folderMap.set(folder.id, folder);
    });
    
    // ルートフォルダを取得
    folders.forEach(folder => {
      if (!folder.parent_id) {
        rootFolders.push(folder);
      }
    });
    
    // 階層的にフォルダを並べる
    const result: Array<{ folder: Folder; level: number }> = [];
    
    const addFolderWithChildren = (folder: Folder, level: number) => {
      result.push({ folder, level });
      
      // 子フォルダを取得
      const children = folders.filter(f => f.parent_id === folder.id);
      children.forEach(child => {
        addFolderWithChildren(child, level + 1);
      });
    };
    
    rootFolders.forEach(folder => {
      addFolderWithChildren(folder, 0);
    });
    
    return result;
  };

  const hierarchicalFolders = buildFolderHierarchy();

  // 初期データの取得
  useEffect(() => {
    fetchInitialData();
  }, [testId]);

  const fetchInitialData = async () => {
    try {
      const [testRes, foldersRes, tagsRes] = await Promise.all([
        fetch(`/api/tests/${testId}`),
        fetch('/api/folders'),
        fetch('/api/tags'),
      ]);

      if (!testRes.ok) {
        throw new Error('テスト情報の取得に失敗しました');
      }
      if (!foldersRes.ok || !tagsRes.ok) {
        throw new Error('マスターデータの取得に失敗しました');
      }

      const testData: TestWithTags = await testRes.json();
      const foldersData = await foldersRes.json();
      const tagsData = await tagsRes.json();

      // フォームに値を設定
      setName(testData.name);
      setSubject(testData.subject);
      setGrade(testData.grade);
      setSelectedFolderIds(testData.folders ? testData.folders.map(f => f.id) : [testData.folder_id]);
      setSelectedTagIds(testData.tags.map(tag => tag.id));
      setPdfPath(testData.pdf_path || null);
      setDescription(testData.description || '');
      setTotalQuestions(testData.total_questions ? String(testData.total_questions) : '');
      setTotalScore(testData.total_score ? String(testData.total_score) : '');

      setFolders(foldersData);
      setTags(tagsData);
    } catch (err: any) {
      console.error('初期データ取得エラー:', err);
      setError(err.message || 'データの取得に失敗しました');
    } finally {
      setInitialLoading(false);
    }
  };

  // タグの選択/解除
  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  // PDFファイル選択
  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイルタイプチェック
    if (file.type !== 'application/pdf') {
      setError('PDFファイルのみアップロード可能です');
      return;
    }

    // ファイルサイズチェック(10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('ファイルサイズは10MB以下にしてください');
      return;
    }

    setPdfFile(file);
    uploadPdf(file);
  };

  // PDFアップロード処理
  const uploadPdf = async (file: File) => {
    setUploadingPdf(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'アップロードに失敗しました');
      }

      const data = await response.json();
      setPdfPath(data.path);
    } catch (err: any) {
      console.error('PDFアップロードエラー:', err);
      setError(err.message || 'PDFのアップロードに失敗しました');
      setPdfFile(null);
    } finally {
      setUploadingPdf(false);
    }
  };

  // PDF削除
  const handleRemovePdf = () => {
    setPdfFile(null);
    setPdfPath(null);
  };

  // フォーム送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // バリデーション
    if (!name.trim()) {
      setError('テスト名を入力してください');
      return;
    }
    if (!subject) {
      setError('科目を選択してください');
      return;
    }
    if (!grade) {
      setError('学年を選択してください');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/tests/${testId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          subject,
          grade,
          folderIds: selectedFolderIds,
          tagIds: selectedTagIds,
          pdfPath,
          description: description.trim() || null,
          totalQuestions: totalQuestions ? parseInt(totalQuestions) : null,
          totalScore: totalScore ? parseInt(totalScore) : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'テストの更新に失敗しました');
      }

      setSuccess(true);

      // 成功メッセージ表示後、一覧画面へリダイレクト
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err: any) {
      console.error('テスト更新エラー:', err);
      setError(err.message || 'テストの更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // キャンセル処理
  const handleCancel = () => {
    router.push('/');
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">テスト情報編集</h1>
          <p className="mt-2 text-gray-600">
            テスト情報を変更してください
          </p>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-red-500 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* 成功メッセージ */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-green-500 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-green-700">
                テストを更新しました。一覧画面に戻ります...
              </span>
            </div>
          </div>
        )}

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 md:p-8">
          <div className="space-y-6">
            {/* テスト名 */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                テスト名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 2023年度 1学期期末テスト"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                disabled={loading || success}
                maxLength={200}
              />
            </div>

            {/* 科目と学年 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 科目 */}
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                  科目 <span className="text-red-500">*</span> <span className="text-gray-500 text-xs">※カテゴリに自動分類されます</span>
                </label>
                <select
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={loading || success}
                >
                  <option value="">選択してください</option>
                  {subjects.map((subj) => (
                    <option key={subj} value={subj}>
                      {subj}
                    </option>
                  ))}
                </select>
              </div>

              {/* 学年 */}
              <div>
                <label htmlFor="grade" className="block text-sm font-medium text-gray-700 mb-2">
                  学年 <span className="text-red-500">*</span> <span className="text-gray-500 text-xs">※カテゴリに自動分類されます</span>
                </label>
                <select
                  id="grade"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={loading || success}
                >
                  <option value="">選択してください</option>
                  {grades.map((gr) => (
                    <option key={gr} value={gr}>
                      {gr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* フォルダ選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                保存先フォルダ <span className="text-gray-500 text-xs">複数選択可 (未選択の場合は「未分類」に保存されます)</span>
              </label>
              <div className="space-y-2">
                {hierarchicalFolders
                  .filter(({ folder }) => folder.id !== 1 && folder.name !== '未分類') // 「すべてのテスト」と「未分類」を除外
                  .map(({ folder, level }) => {
                    const isSelected = selectedFolderIds.includes(folder.id);
                    return (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedFolderIds(selectedFolderIds.filter((id) => id !== folder.id));
                          } else {
                            setSelectedFolderIds([...selectedFolderIds, folder.id]);
                          }
                        }}
                        disabled={loading || success}
                        className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors flex items-center gap-2 ${
                          isSelected
                            ? 'bg-primary text-white border-primary'
                            : level === 0
                            ? 'bg-white text-gray-700 border-gray-300 hover:border-primary'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-primary'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        style={{ marginLeft: `${level * 1.5}rem` }}
                      >
                        <svg
                          className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-white' : 'text-gray-400'}`}
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
                        <span className="flex-1">{folder.name}</span>
                        {isSelected && (
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
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* タグ選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ラベル(タグ) <span className="text-gray-500 text-xs">複数選択可</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    disabled={loading || success}
                    className={`px-4 py-2 rounded-lg border-2 transition-all ${
                      selectedTagIds.includes(tag.id)
                        ? 'border-transparent'
                        : 'border-gray-300 bg-white hover:border-gray-400'
                    }`}
                    style={{
                      backgroundColor: selectedTagIds.includes(tag.id)
                        ? tag.color
                        : undefined,
                      color: selectedTagIds.includes(tag.id)
                        ? '#FFFFFF'
                        : tag.color,
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>

            {/* PDFアップロード */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PDFファイル <span className="text-gray-500 text-xs">任意</span>
              </label>
              
              {!pdfFile && !pdfPath ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handlePdfChange}
                    disabled={loading || success || uploadingPdf}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label
                    htmlFor="pdf-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <svg
                      className="w-12 h-12 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className="text-sm text-gray-600">
                      クリックしてPDFファイルを選択
                    </p>
                    <p className="text-xs text-gray-500">
                      最大10MB
                    </p>
                  </label>
                </div>
              ) : uploadingPdf ? (
                <div className="border-2 border-gray-300 rounded-lg p-6 bg-gray-50">
                  <div className="flex flex-col items-center gap-3">
                    <svg
                      className="animate-spin h-8 w-8 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <p className="text-sm text-gray-600">アップロード中...</p>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-green-300 rounded-lg p-4 bg-green-50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <svg
                        className="w-10 h-10 text-red-500 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {pdfFile?.name || 'PDFファイル'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {pdfFile ? `${(pdfFile.size / 1024 / 1024).toFixed(2)} MB` : 'アップロード完了'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePdf}
                      disabled={loading || success}
                      className="flex-shrink-0 p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      title="削除"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 自由記入欄 */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                備考・メモ <span className="text-gray-500 text-xs">任意</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="テストに関するメモや注意事項など"
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                disabled={loading || success}
                maxLength={500}
              />
              <p className="mt-1 text-xs text-gray-500">{description.length}/500文字</p>
            </div>

            {/* 大問数・満点 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="totalQuestions" className="block text-sm font-medium text-gray-700 mb-2">
                  大問数 <span className="text-gray-500 text-xs">任意</span>
                </label>
                <input
                  type="number"
                  id="totalQuestions"
                  value={totalQuestions}
                  onChange={(e) => setTotalQuestions(e.target.value)}
                  placeholder="例: 5"
                  min="0"
                  max="999"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={loading || success}
                />
              </div>

              <div>
                <label htmlFor="totalScore" className="block text-sm font-medium text-gray-700 mb-2">
                  満点 <span className="text-gray-500 text-xs">任意</span>
                </label>
                <input
                  type="number"
                  id="totalScore"
                  value={totalScore}
                  onChange={(e) => setTotalScore(e.target.value)}
                  placeholder="例: 100"
                  min="0"
                  max="9999"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={loading || success}
                />
              </div>
            </div>
          </div>

          {/* ボタン */}
          <div className="mt-8 flex flex-col-reverse md:flex-row gap-4 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading || success}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>更新中...</span>
                </>
              ) : (
                <span>更新する</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
