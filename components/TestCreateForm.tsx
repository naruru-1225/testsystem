"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Folder, Tag, Grade, Subject } from "@/types/database";

interface TestCreateFormProps {
  /** 受信トレイから引き継ぐPDFパス */
  initialPdfPath?: string;
  /** 受信トレイから引き継ぐテスト名候補 */
  initialName?: string;
  /** 受信トレイアイテムID（テスト作成後にassignedにする） */
  inboxItemId?: number;
}

/**
 * テスト登録フォームコンポーネント
 * 新規テストの作成画面
 */
export default function TestCreateForm({
  initialPdfPath,
  initialName,
  inboxItemId,
}: TestCreateFormProps = {}) {
  const router = useRouter();

  // フォーム入力値
  const [name, setName] = useState(initialName ?? "");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([]); // 複数選択対応、初期値は空
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(initialPdfPath ?? null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // 添付PDF用の状態
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<{path: string, fileName: string}[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const [description, setDescription] = useState("");
  const [totalQuestions, setTotalQuestions] = useState<string>("");
  const [totalScore, setTotalScore] = useState<string>("");

  // マスターデータ
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // UI状態
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}); // フィールド単位エラー (#23)
  const [draftRestored, setDraftRestored] = useState(false); // 自動保存ドラフト復元通知 (#17)

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

  // マスターデータの取得
  useEffect(() => {
    fetchMasterData();
  }, []);

  // 山起時に自動保存ドラフトまたは前回入力値を復元 (#17, #18)
  useEffect(() => {
    const DRAFT_KEY = "test-create-draft";
    const LAST_KEY = "test-create-last-submitted";
    if (typeof window === "undefined") return;
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (!initialName && draft.name !== undefined) setName(draft.name);
        if (draft.subject) setSubject(draft.subject);
        if (draft.grade) setGrade(draft.grade);
        if (draft.selectedFolderIds?.length) setSelectedFolderIds(draft.selectedFolderIds);
        if (draft.selectedTagIds?.length) setSelectedTagIds(draft.selectedTagIds);
        if (draft.description !== undefined) setDescription(draft.description);
        if (draft.totalQuestions !== undefined) setTotalQuestions(draft.totalQuestions);
        if (draft.totalScore !== undefined) setTotalScore(draft.totalScore);
        setDraftRestored(true);
      } catch { /* ignore */ }
      return; // ドラフトがあれば前回値は使わない
    }
    // 前回入力値引継ぎ (#18)
    const lastSubmitted = localStorage.getItem(LAST_KEY);
    if (lastSubmitted) {
      try {
        const last = JSON.parse(lastSubmitted);
        if (last.subject) setSubject(last.subject);
        if (last.grade) setGrade(last.grade);
        if (last.selectedFolderIds?.length) setSelectedFolderIds(last.selectedFolderIds);
        if (last.selectedTagIds?.length) setSelectedTagIds(last.selectedTagIds);
      } catch { /* ignore */ }
    }
  }, []);

  // 入力値変更時に自動保存 (#17)
  useEffect(() => {
    if (success || typeof window === "undefined") return;
    const data = { name, subject, grade, selectedFolderIds, selectedTagIds, description, totalQuestions, totalScore };
    localStorage.setItem("test-create-draft", JSON.stringify(data));
  }, [name, subject, grade, selectedFolderIds, selectedTagIds, description, totalQuestions, totalScore, success]);

  const fetchMasterData = async () => {
    try {
      const [foldersRes, tagsRes, gradesRes, subjectsRes] = await Promise.all([
        fetch("/api/folders"),
        fetch("/api/tags"),
        fetch("/api/grades"),
        fetch("/api/subjects"),
      ]);

      if (!foldersRes.ok || !tagsRes.ok || !gradesRes.ok || !subjectsRes.ok) {
        throw new Error("マスターデータの取得に失敗しました");
      }

      const foldersData = await foldersRes.json();
      const tagsData = await tagsRes.json();
      const gradesData = await gradesRes.json();
      const subjectsData = await subjectsRes.json();

      setFolders(foldersData);
      setTags(tagsData);
      setGrades(gradesData);
      setSubjects(subjectsData);

      // フォルダは初期状態では何も選択しない
      // (空の場合はAPIで自動的に「未分類」フォルダに割り当てられる)
    } catch (err) {
      console.error("マスターデータ取得エラー:", err);
      setError("マスターデータの取得に失敗しました");
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

  // メインファイル選択時の処理（PDFまたは画像）
  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("📎 ファイル選択:", {
      name: file.name,
      type: file.type,
      size: file.size,
      extension: file.name.split(".").pop()?.toLowerCase(),
    });

    // ファイル拡張子を取得
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "";

    // 許可する拡張子
    const allowedExtensions = ["pdf", "heic", "heif", "jpg", "jpeg", "png"];

    // 許可するMIMEタイプ
    const allowedTypes = [
      "application/pdf",
      "image/heic",
      "image/heif",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/x-heic",
      "application/octet-stream",
      "",
    ];

    // 拡張子またはMIMEタイプでチェック
    const isValidExtension = allowedExtensions.includes(fileExt);
    const isValidMimeType = allowedTypes.includes(file.type);

    if (!isValidExtension && !isValidMimeType) {
      console.error("❌ ファイルタイプ拒否:", {
        type: file.type,
        extension: fileExt,
      });
      setError("PDF、HEIC、JPG、PNGファイルのみアップロード可能です");
      return;
    }

    console.log("✅ ファイルタイプ承認:", {
      isValidExtension,
      isValidMimeType,
    });

    // ファイルサイズチェック(10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("ファイルサイズは10MB以下にしてください");
      return;
    }

    setPdfFile(file);
    setError(null);

    // 即座にアップロード
    await uploadPdf(file);
  };

  // メインファイルドラッグ&ドロップ処理（PDFまたは画像）
  const handlePdfDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    if (!file) return;

    console.log("📎 ファイルドロップ:", {
      name: file.name,
      type: file.type,
      size: file.size,
      extension: file.name.split(".").pop()?.toLowerCase(),
    });

    // ファイル拡張子を取得
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "";

    // 許可する拡張子
    const allowedExtensions = ["pdf", "heic", "heif", "jpg", "jpeg", "png"];

    // 許可するMIMEタイプ
    const allowedTypes = [
      "application/pdf",
      "image/heic",
      "image/heif",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/x-heic",
      "application/octet-stream",
      "",
    ];

    // 拡張子またはMIMEタイプでチェック
    const isValidExtension = allowedExtensions.includes(fileExt);
    const isValidMimeType = allowedTypes.includes(file.type);

    if (!isValidExtension && !isValidMimeType) {
      console.error("❌ ファイルタイプ拒否:", {
        type: file.type,
        extension: fileExt,
      });
      setError("PDF、HEIC、JPG、PNGファイルのみアップロード可能です");
      return;
    }

    console.log("✅ ファイルタイプ承認:", {
      isValidExtension,
      isValidMimeType,
    });

    // ファイルサイズチェック(10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("ファイルサイズは10MB以下にしてください");
      return;
    }

    setPdfFile(file);
    setError(null);

    // 即座にアップロード
    await uploadPdf(file);
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

  // 添付ファイル選択時の処理
  const handleAttachmentChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 最大4つまで(メインPDFと合わせて5つ)
    const currentCount = attachmentFiles.length;
    const remainingSlots = 4 - currentCount;

    if (files.length > remainingSlots) {
      setError(`添付ファイルは最大4つまでです(残り${remainingSlots}つ)`);
      return;
    }

    // 許可する拡張子
    const allowedExtensions = ["pdf", "heic", "heif", "jpg", "jpeg", "png"];

    // 許可するMIMEタイプ
    const allowedTypes = [
      "application/pdf",
      "image/heic",
      "image/heif",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/x-heic",
      "application/octet-stream",
      "",
    ];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "";

      console.log(`📎 添付ファイル ${i + 1}:`, {
        name: file.name,
        type: file.type,
        size: file.size,
        extension: fileExt,
      });

      const isValidExtension = allowedExtensions.includes(fileExt);
      const isValidMimeType = allowedTypes.includes(file.type);

      if (!isValidExtension && !isValidMimeType) {
        console.error("❌ ファイルタイプ拒否:", {
          type: file.type,
          extension: fileExt,
        });
        setError("PDF、HEIC、JPG、PNGファイルのみアップロード可能です");
        return;
      }

      // ファイルサイズチェック(10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name}: ファイルサイズは10MB以下にしてください`);
        return;
      }
    }

    // ファイルを配列に変換
    const fileArray = Array.from(files);
    setAttachmentFiles((prev) => [...prev, ...fileArray]);
    setError(null);

    // 各ファイルをアップロード
    for (const file of fileArray) {
      await uploadAttachment(file);
    }
  };

  // 添付ファイル ドラッグ&ドロップ処理
  const handleAttachmentDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    // 最大4つまで(メインPDFと合わせて5つ)
    const currentCount = attachmentFiles.length;
    const remainingSlots = 4 - currentCount;

    if (files.length > remainingSlots) {
      setError(`添付ファイルは最大4つまでです(残り${remainingSlots}つ)`);
      return;
    }

    // 許可する拡張子
    const allowedExtensions = ["pdf", "heic", "heif", "jpg", "jpeg", "png"];

    // 許可するMIMEタイプ
    const allowedTypes = [
      "application/pdf",
      "image/heic",
      "image/heif",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/x-heic",
      "application/octet-stream",
      "",
    ];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "";

      console.log(`📎 添付ファイル(ドロップ) ${i + 1}:`, {
        name: file.name,
        type: file.type,
        size: file.size,
        extension: fileExt,
      });

      const isValidExtension = allowedExtensions.includes(fileExt);
      const isValidMimeType = allowedTypes.includes(file.type);

      if (!isValidExtension && !isValidMimeType) {
        console.error("❌ ファイルタイプ拒否:", {
          type: file.type,
          extension: fileExt,
        });
        setError("PDF、HEIC、JPG、PNGファイルのみアップロード可能です");
        return;
      }

      // ファイルサイズチェック(10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name}: ファイルサイズは10MB以下にしてください`);
        return;
      }
    }

    // ファイルを配列に変換
    const fileArray = Array.from(files);
    setAttachmentFiles((prev) => [...prev, ...fileArray]);
    setError(null);

    // 各ファイルをアップロード
    for (const file of fileArray) {
      await uploadAttachment(file);
    }
  };

  const handleAttachmentDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // 添付PDFアップロード処理
  const uploadAttachment = async (file: File) => {
    setUploadingAttachment(true);
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
      setUploadedAttachments((prev) => [...prev, { path: data.path, fileName: data.fileName }]);
    } catch (err: any) {
      console.error("添付PDFアップロードエラー:", err);
      setError(err.message || "添付PDFのアップロードに失敗しました");
      // エラーの場合、ファイルリストから削除
      setAttachmentFiles((prev) => prev.filter((f) => f !== file));
    } finally {
      setUploadingAttachment(false);
    }
  };

  // 添付PDF削除
  const handleRemoveAttachment = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadedAttachments((prev) => prev.filter((_, i) => i !== index));
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
      const response = await fetch("/api/tests", {
        method: "POST",
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
          attachmentPaths: uploadedAttachments.map(a => a.path), // 添付PDFのパスを追加
          attachmentFileNames: uploadedAttachments.map(a => a.fileName), // 添付PDFのファイル名を追加
          description: description.trim() || null,
          totalQuestions: totalQuestions ? parseInt(totalQuestions) : null,
          totalScore: totalScore ? parseInt(totalScore) : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "テストの作成に失敗しました");
      }

      setSuccess(true);

      // 自動保存: ドラフト削除、前回値を保存 (#17, #18)
      if (typeof window !== "undefined") {
        localStorage.removeItem("test-create-draft");
        localStorage.setItem("test-create-last-submitted",
          JSON.stringify({ subject, grade, selectedFolderIds, selectedTagIds })
        );
      }

      // 受信トレイのアイテムをassignedに更新
      if (inboxItemId) {
        try {
          await fetch(`/api/inbox/${inboxItemId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "assigned" }),
          });
        } catch {
          // 失敗しても無視（テスト作成は成功済み）
        }
      }

      // 成功メッセージ表示後、一覧画面へリダイレクト
      setTimeout(() => {
        // 受信トレイから来た場合は受信トレイへ戻る
        router.push(inboxItemId ? "/inbox" : "/");
      }, 1500);
    } catch (err: any) {
      console.error("テスト作成エラー:", err);
      setError(err.message || "テストの作成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // キャンセル処理
  const handleCancel = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">新規テスト登録</h1>
          <p className="mt-2 text-gray-600">テスト情報を入力してください</p>
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
                テストを登録しました。一覧画面に戻ります...
              </span>
            </div>
          </div>
        )}

        {/* 自動保存ドラフト復元通知 (#17) */}
        {draftRestored && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
            <span className="text-yellow-800 text-sm">⚠️ 前回の入力内容を自動復元しました</span>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem("test-create-draft");
                setDraftRestored(false);
                setName(initialName ?? ""); setSubject(""); setGrade("");
                setSelectedFolderIds([]); setSelectedTagIds([]);
                setDescription(""); setTotalQuestions(""); setTotalScore("");
              }}
              className="text-yellow-600 text-xs underline hover:text-yellow-800"
            >クリア</button>
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
                メインPDFファイル{" "}
                <span className="text-gray-500 text-xs">任意</span>
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
                      クリックしてファイルを選択
                    </p>
                    <p className="text-xs text-gray-500">
                      または、ここにファイルをドラッグ&ドロップ
                    </p>
                    <p className="text-xs text-gray-500">
                      対応形式: PDF、HEIC、JPG、PNG（最大10MB）
                    </p>
                    <p className="text-xs text-gray-400">
                      ※ HEICファイルは自動的にJPEGに変換されます
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

            {/* 添付ファイルアップロード */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                添付ファイル{" "}
                <span className="text-gray-500 text-xs">
                  任意 (最大4つまで・PDF/画像)
                </span>
              </label>

              {/* アップロード済み添付ファイル一覧 */}
              {attachmentFiles.length > 0 && (
                <div className="space-y-2 mb-3">
                  {attachmentFiles.map((file, index) => (
                    <div
                      key={index}
                      className="border-2 border-blue-300 rounded-lg p-3 bg-blue-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <svg
                            className="w-8 h-8 text-blue-500 flex-shrink-0"
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
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(index)}
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
                  ))}
                </div>
              )}

              {/* アップロードボタン(4つ未満の場合のみ表示) */}
              {attachmentFiles.length < 4 && (
                <>
                  {uploadingAttachment ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50">
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
                        <p className="text-sm text-gray-600">
                          アップロード中...
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 transition-colors"
                      onDrop={handleAttachmentDrop}
                      onDragOver={handleAttachmentDragOver}
                    >
                      <input
                        type="file"
                        accept=".pdf,.heic,.heif,.jpg,.jpeg,.png,image/*,application/pdf"
                        onChange={handleAttachmentChange}
                        disabled={loading || success || uploadingAttachment}
                        className="hidden"
                        id="attachment-upload"
                        multiple
                      />
                      <label
                        htmlFor="attachment-upload"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        <svg
                          className="w-10 h-10 text-gray-400"
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
                        <p className="text-xs text-gray-500">
                          または、ここにファイルをドラッグ&ドロップ
                        </p>
                        <p className="text-xs text-gray-500">
                          対応形式: PDF、HEIC、JPG、PNG
                        </p>
                        <p className="text-xs text-gray-400">
                          複数選択可 • 各10MB以下 • 残り
                          {4 - attachmentFiles.length}つ
                        </p>
                      </label>
                    </div>
                  )}
                </>
              )}

              {attachmentFiles.length >= 4 && (
                <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                  <p className="text-sm text-gray-600 text-center">
                    添付ファイルは最大4つまでです
                  </p>
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
              <p className="mt-1 text-xs text-gray-500">
                {description.length}/500文字
              </p>
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
                  <span>{uploadingPdf || uploadingAttachment ? "アップロード中..." : "登録中..."}</span>
                </>
              ) : (
                <span>登録する</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
