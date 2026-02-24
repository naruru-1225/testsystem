"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  Folder,
  Tag,
  TestWithTags,
  TestAttachment,
  Grade,
  Subject,
} from "@/types/database";

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
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([1]); // 複数選択対応
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [description, setDescription] = useState("");
  const [totalQuestions, setTotalQuestions] = useState<string>("");
  const [totalScore, setTotalScore] = useState<string>("");

  // 添付ファイル関連
  const [attachments, setAttachments] = useState<TestAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [editingAttachmentId, setEditingAttachmentId] = useState<number | null>(null);
  const [editingAttachmentName, setEditingAttachmentName] = useState("");

  // マスターデータ
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // UI状態
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}); // フィールド単位エラー (#23)

  // フォルダの展開状態
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(
    new Set()
  );

  // フォルダツリーを構築する関数
  const buildFolderTree = () => {
    const rootFolders: Folder[] = [];
    const childMap = new Map<number, Folder[]>();

    // 子フォルダをマップに格納
    folders.forEach((folder) => {
      if (folder.parent_id) {
        const children = childMap.get(folder.parent_id) || [];
        children.push(folder);
        childMap.set(folder.parent_id, children);
      } else {
        rootFolders.push(folder);
      }
    });

    return { rootFolders, childMap };
  };

  const { rootFolders, childMap } = buildFolderTree();

  // フォルダの展開/折りたたみを切り替え
  const toggleFolder = (folderId: number) => {
    const newExpanded = new Set(expandedFolderIds);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolderIds(newExpanded);
  };

  // フォルダの選択/選択解除を切り替え
  const toggleFolderSelection = (folderId: number) => {
    if (selectedFolderIds.includes(folderId)) {
      setSelectedFolderIds(selectedFolderIds.filter((id) => id !== folderId));
    } else {
      setSelectedFolderIds([...selectedFolderIds, folderId]);
    }
  };

  // 旧フォルダ階層構造関数（削除予定）
  const buildFolderHierarchy = () => {
    const folderMap = new Map<number, Folder>();
    const rootFolders: Folder[] = [];

    // マップを作成
    folders.forEach((folder) => {
      folderMap.set(folder.id, folder);
    });

    // ルートフォルダを取得
    folders.forEach((folder) => {
      if (!folder.parent_id) {
        rootFolders.push(folder);
      }
    });

    // 階層的にフォルダを並べる
    const result: Array<{ folder: Folder; level: number }> = [];

    const addFolderWithChildren = (folder: Folder, level: number) => {
      result.push({ folder, level });

      // 子フォルダを取得
      const children = folders.filter((f) => f.parent_id === folder.id);
      children.forEach((child) => {
        addFolderWithChildren(child, level + 1);
      });
    };

    rootFolders.forEach((folder) => {
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
      const [
        testRes,
        foldersRes,
        tagsRes,
        attachmentsRes,
        gradesRes,
        subjectsRes,
      ] = await Promise.all([
        fetch(`/api/tests/${testId}`),
        fetch("/api/folders"),
        fetch("/api/tags"),
        fetch(`/api/tests/${testId}/attachments`),
        fetch("/api/grades"),
        fetch("/api/subjects"),
      ]);

      if (!testRes.ok) {
        throw new Error("テスト情報の取得に失敗しました");
      }
      if (!foldersRes.ok || !tagsRes.ok || !gradesRes.ok || !subjectsRes.ok) {
        throw new Error("マスターデータの取得に失敗しました");
      }

      const testData: TestWithTags = await testRes.json();
      const foldersData = await foldersRes.json();
      const tagsData = await tagsRes.json();
      const attachmentsData = attachmentsRes.ok
        ? await attachmentsRes.json()
        : { attachments: [] };
      const gradesData = await gradesRes.json();
      const subjectsData = await subjectsRes.json();

      // フォームに値を設定
      setName(testData.name);
      setSubject(testData.subject);
      setGrade(testData.grade);
      setSelectedFolderIds(
        testData.folders
          ? testData.folders.map((f) => f.id)
          : [testData.folder_id]
      );
      setSelectedTagIds(testData.tags.map((tag) => tag.id));
      setPdfPath(testData.pdf_path || null);
      setDescription(testData.description || "");
      setTotalQuestions(
        testData.total_questions ? String(testData.total_questions) : ""
      );
      setTotalScore(testData.total_score ? String(testData.total_score) : "");

      setFolders(foldersData);
      setTags(tagsData);
      setAttachments(attachmentsData.attachments || []);
      setGrades(gradesData);
      setSubjects(subjectsData);
    } catch (err: any) {
      console.error("初期データ取得エラー:", err);
      setError(err.message || "データの取得に失敗しました");
    } finally {
      setInitialLoading(false);
    }
  };

  // フォルダアイテムを再帰的にレンダリング
  const renderFolderItem = (
    folder: Folder,
    level: number,
    childMap: Map<number, Folder[]>
  ): React.ReactElement => {
    const hasChildren = childMap.has(folder.id);
    const isExpanded = expandedFolderIds.has(folder.id);
    const isSelected = selectedFolderIds.includes(folder.id);
    const children = childMap.get(folder.id) || [];

    return (
      <div key={folder.id}>
        <div className="flex items-center gap-1">
          {/* 展開/折りたたみボタン */}
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleFolder(folder.id)}
              className="p-1 hover:bg-gray-200 rounded flex-shrink-0"
              disabled={loading || success}
            >
              <svg
                className={`w-4 h-4 transition-transform text-gray-600 ${
                  isExpanded ? "rotate-90" : ""
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
          ) : (
            <div className="w-6 flex-shrink-0"></div>
          )}

          {/* フォルダ選択ボタン */}
          <button
            type="button"
            onClick={() => toggleFolderSelection(folder.id)}
            disabled={loading || success}
            className={`flex-1 text-left px-3 py-2 rounded-lg border-2 transition-colors flex items-center gap-2 ${
              isSelected
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-700 border-gray-300 hover:border-primary"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            style={{ marginLeft: `${level * 1.5}rem` }}
          >
            <svg
              className={`w-5 h-5 flex-shrink-0 ${
                isSelected ? "text-white" : "text-gray-400"
              }`}
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
                className="w-5 h-5 flex-shrink-0 text-white"
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
        </div>

        {/* 子フォルダを再帰的にレンダリング */}
        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {children.map((child) =>
              renderFolderItem(child, level + 1, childMap)
            )}
          </div>
        )}
      </div>
    );
  };

  // タグの選択/解除
  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  // メインファイル選択（PDFまたは画像）
  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイルタイプチェック（PDFと画像のみ）
    const allowedTypes = [
      "application/pdf",
      "image/heic",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    if (!allowedTypes.includes(file.type)) {
      setError("PDF、HEIC、JPG、PNGファイルのみアップロード可能です");
      return;
    }

    // ファイルサイズチェック(10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("ファイルサイズは10MB以下にしてください");
      return;
    }

    setPdfFile(file);
    uploadPdf(file);
  };

  // メインファイルドラッグ&ドロップ処理（PDFまたは画像）
  const handlePdfDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    if (!file) return;

    // ファイルタイプチェック（PDFと画像のみ）
    const allowedTypes = [
      "application/pdf",
      "image/heic",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    if (!allowedTypes.includes(file.type)) {
      setError("PDF、HEIC、JPG、PNGファイルのみアップロード可能です");
      return;
    }

    // ファイルサイズチェック(10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("ファイルサイズは10MB以下にしてください");
      return;
    }

    setPdfFile(file);
    uploadPdf(file);
  };

  const handlePdfDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // PDFアップロード処理
  const uploadPdf = async (file: File) => {
    setUploadingPdf(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "アップロードに失敗しました");
      }

      const data = await response.json();
      setPdfPath(data.path);
    } catch (err: any) {
      console.error("PDFアップロードエラー:", err);
      setError(err.message || "PDFのアップロードに失敗しました");
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

  // 添付ファイルアップロード
  const handleAttachmentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイルタイプチェック（PDFと画像のみ）
    const allowedTypes = [
      "application/pdf",
      "image/heic",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    if (!allowedTypes.includes(file.type)) {
      setError("PDF、HEIC、JPG、PNGファイルのみアップロード可能です");
      return;
    }

    // ファイルサイズチェック(10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("ファイルサイズは10MB以下にしてください");
      return;
    }

    // 合計添付数チェック(メインPDF + 添付ファイル = 最大5つ)
    const totalCount = (pdfPath ? 1 : 0) + attachments.length;
    if (totalCount >= 5) {
      setError("添付ファイルはメインPDFを含めて合計5つまでです");
      return;
    }

    await uploadAttachment(file);
  };

  // 添付ファイル ドラッグ&ドロップ処理
  const handleAttachmentDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    if (!file) return;

    // ファイルタイプチェック（PDFと画像のみ）
    const allowedTypes = [
      "application/pdf",
      "image/heic",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    if (!allowedTypes.includes(file.type)) {
      setError("PDF、HEIC、JPG、PNGファイルのみアップロード可能です");
      return;
    }

    // ファイルサイズチェック(10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("ファイルサイズは10MB以下にしてください");
      return;
    }

    // 合計添付数チェック(メインPDF + 添付ファイル = 最大5つ)
    const totalCount = (pdfPath ? 1 : 0) + attachments.length;
    if (totalCount >= 5) {
      setError("添付ファイルはメインPDFを含めて合計5つまでです");
      return;
    }

    await uploadAttachment(file);
  };

  const handleAttachmentDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // 添付ファイルのアップロード処理
  const uploadAttachment = async (file: File) => {
    setUploadingAttachment(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("testId", testId.toString());

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "アップロードに失敗しました");
      }

      const data = await response.json();

      // 添付ファイルリストを更新
      const newAttachment: TestAttachment = {
        id: data.attachmentId,
        test_id: testId,
        file_name: data.fileName,
        file_path: data.path,
        mime_type: data.mimeType ?? null,
        file_size: typeof data.size === "number" ? data.size : null,
        uploaded_at: new Date().toISOString(),
      };
      setAttachments([...attachments, newAttachment]);
    } catch (err: any) {
      console.error("添付ファイルアップロードエラー:", err);
      setError(err.message || "添付ファイルのアップロードに失敗しました");
    } finally {
      setUploadingAttachment(false);
    }
  };

  // 添付ファイル削除
  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!confirm("この添付ファイルを削除しますか?")) return;

    try {
      const response = await fetch(
        `/api/tests/${testId}/attachments?attachmentId=${attachmentId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "削除に失敗しました");
      }

      // リストから削除
      setAttachments(attachments.filter((a) => a.id !== attachmentId));
    } catch (err: any) {
      console.error("添付ファイル削除エラー:", err);
      setError(err.message || "添付ファイルの削除に失敗しました");
    }
  };

  // 添付ファイル名変更
  const handleRenameAttachment = async (attachmentId: number) => {
    if (!editingAttachmentName.trim()) {
      setEditingAttachmentId(null);
      return;
    }

    try {
      const response = await fetch(
        `/api/tests/${testId}/attachments`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attachmentId, fileName: editingAttachmentName.trim() }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "名前の変更に失敗しました");
      }

      // ローカルの一覧を更新
      setAttachments(attachments.map(a =>
        a.id === attachmentId ? { ...a, file_name: editingAttachmentName.trim() } : a
      ));
      setEditingAttachmentId(null);
    } catch (err: any) {
      console.error("添付ファイル名変更エラー:", err);
      setError(err.message || "名前の変更に失敗しました");
    }
  };

  // フォーム送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // フィールド単位バリデーション (#23)
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "テスト名を入力してください";
    if (!subject) errors.subject = "科目を選択してください";
    if (!grade) errors.grade = "学年を選択してください";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setLoading(true);

    try {
      const response = await fetch(`/api/tests/${testId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
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
        throw new Error(errorData.error || "テストの更新に失敗しました");
      }

      setSuccess(true);

      // 成功メッセージ表示後、一覧画面へリダイレクト
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch (err: any) {
      console.error("テスト更新エラー:", err);
      setError(err.message || "テストの更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // キャンセル処理
  const handleCancel = () => {
    router.push("/");
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
          <p className="mt-2 text-gray-600">テスト情報を変更してください</p>
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
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow-md p-6 md:p-8"
        >
          <div className="space-y-6">
            {/* テスト名 */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                テスト名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => { setName(e.target.value); setFieldErrors((p) => ({ ...p, name: undefined as any })); }}
                placeholder="例: 2023年度 1学期期末テスト"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                  fieldErrors.name ? "border-red-400 bg-red-50" : "border-gray-300"
                }`}
                disabled={loading || success}
                maxLength={200}
              />
              {fieldErrors.name && <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>}
            </div>

            {/* 科目と学年 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 科目 */}
              <div>
                <label
                  htmlFor="subject"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  科目 <span className="text-red-500">*</span>{" "}
                  <span className="text-gray-500 text-xs">
                    ※カテゴリに自動分類されます
                  </span>
                </label>
                <select
                  id="subject"
                  value={subject}
                  onChange={(e) => { setSubject(e.target.value); setFieldErrors((p) => ({ ...p, subject: undefined as any })); }}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    fieldErrors.subject ? "border-red-400 bg-red-50" : "border-gray-300"
                  }`}
                  disabled={loading || success}
                >
                  <option value="">選択してください</option>
                  {subjects.map((subj) => (
                    <option key={subj.id} value={subj.name}>
                      {subj.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.subject && <p className="mt-1 text-sm text-red-600">{fieldErrors.subject}</p>}
              </div>

              {/* 学年 */}
              <div>
                <label
                  htmlFor="grade"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  学年 <span className="text-red-500">*</span>{" "}
                  <span className="text-gray-500 text-xs">
                    ※カテゴリに自動分類されます
                  </span>
                </label>
                <select
                  id="grade"
                  value={grade}
                  onChange={(e) => { setGrade(e.target.value); setFieldErrors((p) => ({ ...p, grade: undefined as any })); }}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    fieldErrors.grade ? "border-red-400 bg-red-50" : "border-gray-300"
                  }`}
                  disabled={loading || success}
                >
                  <option value="">選択してください</option>
                  {grades.map((gr) => (
                    <option key={gr.id} value={gr.name}>
                      {gr.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.grade && <p className="mt-1 text-sm text-red-600">{fieldErrors.grade}</p>}
              </div>
            </div>

            {/* フォルダ選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                保存先フォルダ{" "}
                <span className="text-gray-500 text-xs">
                  複数選択可 (未選択の場合は「未分類」に保存されます)
                </span>
              </label>
              <div className="border border-gray-300 rounded-lg p-4 bg-white max-h-80 overflow-y-auto">
                {rootFolders
                  .filter(
                    (folder) => folder.id !== 1 && folder.name !== "未分類"
                  )
                  .map((folder) => renderFolderItem(folder, 0, childMap))}
              </div>
            </div>

            {/* タグ選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ラベル(タグ){" "}
                <span className="text-gray-500 text-xs">複数選択可</span>
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
                        ? "border-transparent"
                        : "border-gray-300 bg-white hover:border-gray-400"
                    }`}
                    style={{
                      backgroundColor: selectedTagIds.includes(tag.id)
                        ? tag.color
                        : undefined,
                      color: selectedTagIds.includes(tag.id)
                        ? "#FFFFFF"
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
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 transition-colors"
                  onDrop={handlePdfDrop}
                  onDragOver={handlePdfDragOver}
                >
                  <input
                    type="file"
                    accept=".pdf,.heic,.heif,.jpg,.jpeg,.png,image/*,application/pdf"
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
                      または、ここにファイルをドラッグ&ドロップ
                    </p>
                    <p className="text-xs text-gray-500">最大10MB</p>
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
                          {pdfFile?.name || "PDFファイル"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {pdfFile
                            ? `${(pdfFile.size / 1024 / 1024).toFixed(2)} MB`
                            : "アップロード完了"}
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

            {/* 添付ファイル */}
            <div>
              <label className="block text-sm font-medium mb-3">
                添付ファイル{" "}
                <span className="text-gray-500 text-xs">
                  メインPDF含めて合計5つまで（PDF/画像）
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  ({(pdfPath ? 1 : 0) + attachments.length}/5)
                </span>
              </label>

              {/* 添付ファイルリスト */}
              {attachments.length > 0 && (
                <div className="mb-3 space-y-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {/* ファイルタイプに応じたアイコン表示 */}
                        {attachment.mime_type?.startsWith("image/") ? (
                          <svg
                            className="w-8 h-8 text-blue-500 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                          </svg>
                        ) : (
                          <svg
                            className="w-8 h-8 text-red-500 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
                            <path d="M14 2v6h6M10 13h4M10 17h4" />
                          </svg>
                        )}
                        <div className="flex-1 min-w-0">
                          {editingAttachmentId === attachment.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editingAttachmentName}
                                onChange={(e) => setEditingAttachmentName(e.target.value)}
                                className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleRenameAttachment(attachment.id);
                                  if (e.key === "Escape") setEditingAttachmentId(null);
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleRenameAttachment(attachment.id)}
                                className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                                title="保存"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingAttachmentId(null)}
                                className="p-1 text-gray-500 hover:bg-gray-200 rounded transition-colors"
                                title="キャンセル"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {attachment.file_name}
                            </p>
                          )}
                          <p className="text-xs text-gray-500">
                            {attachment.file_size
                              ? `${(attachment.file_size / 1024 / 1024).toFixed(
                                  2
                                )} MB • `
                              : ""}
                            {new Date(attachment.uploaded_at).toLocaleString(
                              "ja-JP"
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {/* 名前変更ボタン */}
                        {editingAttachmentId !== attachment.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAttachmentId(attachment.id);
                              setEditingAttachmentName(attachment.file_name);
                            }}
                            disabled={loading || success}
                            className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                            title="名前変更"
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
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                          </button>
                        )}
                        <a
                          href={attachment.file_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="開く"
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
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(attachment.id)}
                          disabled={loading || success}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
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
                  ))}
                </div>
              )}

              {/* アップロードボタン */}
              {(pdfPath ? 1 : 0) + attachments.length < 5 && (
                <div
                  onDrop={handleAttachmentDrop}
                  onDragOver={handleAttachmentDragOver}
                >
                  <input
                    type="file"
                    id="attachment-upload"
                    accept=".pdf,.heic,.heif,.jpg,.jpeg,.png,image/*,application/pdf"
                    onChange={handleAttachmentUpload}
                    disabled={loading || success || uploadingAttachment}
                    className="hidden"
                  />
                  <label
                    htmlFor="attachment-upload"
                    className={`block w-full p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                      loading || success || uploadingAttachment
                        ? "border-gray-200 bg-gray-50 cursor-not-allowed"
                        : "border-blue-300 hover:border-blue-400 hover:bg-blue-50"
                    }`}
                  >
                    {uploadingAttachment ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm text-gray-600">
                          アップロード中...
                        </span>
                      </div>
                    ) : (
                      <>
                        <svg
                          className="w-8 h-8 mx-auto mb-2 text-gray-400"
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
                        <p className="text-sm text-gray-600">
                          クリックしてファイルを追加
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          または、ここにファイルをドラッグ&ドロップ
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          PDF、画像(HEIC/JPG/PNG) • 各10MB以下
                        </p>
                      </>
                    )}
                  </label>
                </div>
              )}
            </div>

            {/* 自由記入欄 */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
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
              <div className="mt-1 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  {description.length}/500文字
                </p>
                {description.includes("メールから自動登録") && (
                  <button
                    type="button"
                    onClick={() => {
                      // 自動登録の説明文を削除
                      const cleaned = description
                        .replace(/📧\s*メールから自動登録[^\n]*/g, "")
                        .replace(/送信者:\s*[^\n]*/g, "")
                        .replace(/受信日時:\s*[^\n]*/g, "")
                        .replace(/件名:\s*[^\n]*/g, "")
                        .replace(/\n{2,}/g, "\n")
                        .trim();
                      setDescription(cleaned);
                    }}
                    disabled={loading || success}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors"
                  >
                    <span>📧</span>
                    <span>自動登録マークを解除</span>
                  </button>
                )}
              </div>
            </div>

            {/* 大問数・満点 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="totalQuestions"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
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
                <label
                  htmlFor="totalScore"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
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
              disabled={loading || success || uploadingPdf || uploadingAttachment}
              className="px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading || uploadingPdf || uploadingAttachment ? (
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
                  <span>{uploadingPdf || uploadingAttachment ? "アップロード中..." : "更新中..."}</span>
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
