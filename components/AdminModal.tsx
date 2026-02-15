"use client";

import { useState, useEffect } from "react";
import type { Folder, Tag, Grade, Subject } from "@/types/database";

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onExportCSV?: () => void;
}

type TabType = "folders" | "tags" | "grades" | "subjects" | "restore" | "email";

interface EmailConfigState {
  imap_host: string;
  imap_port: number;
  imap_user: string;
  imap_password: string;
  enabled: number;
  default_subject: string;
  default_grade: string;
  default_folder_id: number | null;
  default_tag_name: string;
  name_prefix: string;
}

interface EmailImportLogEntry {
  id: number;
  message_id: string;
  subject: string;
  from_address: string;
  file_name: string;
  status: string;
  error_message: string | null;
  imported_at: string;
}

export default function AdminModal({
  isOpen,
  onClose,
  onUpdate,
  onExportCSV,
}: AdminModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("folders");

  // フォルダ関連
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState<number | null>(
    null
  );
  const [editingFolderId, setEditingFolderId] = useState<number | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [editingFolderParentId, setEditingFolderParentId] = useState<
    number | null
  >(null);

  // タグ関連
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editingTagName, setEditingTagName] = useState("");
  const [editingTagColor, setEditingTagColor] = useState("");

  // 学年関連
  const [grades, setGrades] = useState<Grade[]>([]);
  const [newGradeName, setNewGradeName] = useState("");
  const [editingGradeId, setEditingGradeId] = useState<number | null>(null);
  const [editingGradeName, setEditingGradeName] = useState("");

  // 科目関連
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [editingSubjectName, setEditingSubjectName] = useState("");

  // バックアップ復元関連
  const [backupTests, setBackupTests] = useState<any[]>([]);
  const [selectedTests, setSelectedTests] = useState<Set<number>>(new Set());
  const [backupLoading, setBackupLoading] = useState(false);

  // メール設定関連
  const [emailConfig, setEmailConfig] = useState<EmailConfigState>({
    imap_host: "imap.gmail.com",
    imap_port: 993,
    imap_user: "",
    imap_password: "",
    enabled: 0,
    default_subject: "未分類",
    default_grade: "未設定",
    default_folder_id: null,
    default_tag_name: "自動登録",
    name_prefix: "[自動登録]",
  });
  const [emailPollerRunning, setEmailPollerRunning] = useState(false);
  const [emailImportLogs, setEmailImportLogs] = useState<EmailImportLogEntry[]>([]);
  const [emailStats, setEmailStats] = useState({ total: 0, success: 0, error: 0 });
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // UI状態
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 定義済みカラーパレット
  const colorPalette = [
    "#3B82F6", // 青
    "#10B981", // 緑
    "#EF4444", // 赤
    "#8B5CF6", // 紫
    "#F59E0B", // オレンジ
    "#EC4899", // ピンク
    "#6366F1", // インディゴ
    "#14B8A6", // ティール
  ];

  useEffect(() => {
    if (isOpen) {
      fetchFolders();
      fetchTags();
      fetchGrades();
      fetchSubjects();
      fetchEmailConfig();
    }
  }, [isOpen]);

  // メール設定取得
  const fetchEmailConfig = async () => {
    try {
      const response = await fetch("/api/email-settings");
      if (!response.ok) return;
      const data = await response.json();
      if (data.config) {
        setEmailConfig({
          imap_host: data.config.imap_host || "imap.gmail.com",
          imap_port: data.config.imap_port || 993,
          imap_user: data.config.imap_user || "",
          imap_password: data.config.imap_password || "",
          enabled: data.config.enabled || 0,
          default_subject: data.config.default_subject || "未分類",
          default_grade: data.config.default_grade || "未設定",
          default_folder_id: data.config.default_folder_id || null,
          default_tag_name: data.config.default_tag_name || "自動登録",
          name_prefix: data.config.name_prefix || "[自動登録]",
        });
      }
      setEmailPollerRunning(data.status?.running || false);
      setEmailImportLogs(data.logs || []);
      setEmailStats(data.stats || { total: 0, success: 0, error: 0 });
    } catch (err) {
      console.error("メール設定取得エラー:", err);
    }
  };

  // メール設定保存
  const handleSaveEmailConfig = async () => {
    setEmailLoading(true);
    setError(null);
    setEmailTestResult(null);

    try {
      const response = await fetch("/api/email-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailConfig),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "設定の保存に失敗しました");
      }

      setSuccess("メール設定を保存しました");
      await fetchEmailConfig();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEmailLoading(false);
    }
  };

  // 接続テスト
  const handleTestEmailConnection = async () => {
    setEmailLoading(true);
    setEmailTestResult(null);
    setError(null);

    try {
      const response = await fetch("/api/email-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          imap_host: emailConfig.imap_host,
          imap_port: emailConfig.imap_port,
          imap_user: emailConfig.imap_user,
          imap_password: emailConfig.imap_password,
        }),
      });

      const result = await response.json();
      setEmailTestResult(result);

      if (result.success) {
        setSuccess("✅ 接続テスト成功！");
      } else {
        setError(`接続テスト失敗: ${result.error}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEmailLoading(false);
    }
  };

  // 手動メール取得
  const handleManualFetch = async () => {
    setEmailLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/email-fetch", {
        method: "POST",
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(result.message);
        if (result.imported > 0) {
          onUpdate();
        }
        await fetchEmailConfig(); // ログ更新
      } else {
        throw new Error(result.error || "取得に失敗しました");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEmailLoading(false);
    }
  };

  const fetchFolders = async () => {
    try {
      const response = await fetch("/api/folders");
      if (!response.ok) throw new Error("フォルダの取得に失敗しました");
      const data = await response.json();
      setFolders(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await fetch("/api/tags");
      if (!response.ok) throw new Error("タグの取得に失敗しました");
      const data = await response.json();
      setTags(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchGrades = async () => {
    try {
      const response = await fetch("/api/grades");
      if (!response.ok) throw new Error("学年の取得に失敗しました");
      const data = await response.json();
      setGrades(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchSubjects = async () => {
    try {
      const response = await fetch("/api/subjects");
      if (!response.ok) throw new Error("科目の取得に失敗しました");
      const data = await response.json();
      setSubjects(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // フォルダ作成
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setError("フォルダ名を入力してください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentId: newFolderParentId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "フォルダの作成に失敗しました");
      }

      setSuccess("フォルダを作成しました");
      setNewFolderName("");
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
      setError("フォルダ名を入力してください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/folders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingFolderName.trim(),
          parentId: editingFolderParentId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "フォルダの更新に失敗しました");
      }

      setSuccess("フォルダを更新しました");
      setEditingFolderId(null);
      setEditingFolderName("");
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
  const handleDeleteFolder = async (
    id: number,
    name: string,
    force: boolean = false
  ) => {
    // 「未分類」フォルダは削除不可
    if (name === "未分類") {
      setError("「未分類」フォルダは削除できません");
      return;
    }

    if (!force && !confirm(`「${name}」を削除してもよろしいですか？`)) return;

    setLoading(true);
    setError(null);

    try {
      const url = force
        ? `/api/folders/${id}?force=true`
        : `/api/folders/${id}`;
      const response = await fetch(url, {
        method: "DELETE",
      });

      const responseData = await response.json();

      if (!response.ok) {
        // テストが存在する場合、強制削除の確認
        if (response.status === 409 && responseData.canForceDelete) {
          const forceDelete = confirm(
            `${responseData.error}\n\n` +
              `それでもフォルダを削除しますか？\n` +
              `（テストは「未分類」フォルダに移動されます）`
          );

          if (forceDelete) {
            // 強制削除を実行
            return handleDeleteFolder(id, name, true);
          }
          setLoading(false);
          return;
        }

        throw new Error(responseData.error || "フォルダの削除に失敗しました");
      }

      if (responseData.movedToUncategorized) {
        setSuccess("フォルダを削除し、テストを「未分類」に移動しました");
      } else {
        setSuccess("フォルダを削除しました");
      }

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
      setError("タグ名を入力してください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "タグの作成に失敗しました");
      }

      setSuccess("タグを作成しました");
      setNewTagName("");
      setNewTagColor("#3B82F6");
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
      setError("タグ名を入力してください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tags/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingTagName.trim(),
          color: editingTagColor,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "タグの更新に失敗しました");
      }

      setSuccess("タグを更新しました");
      setEditingTagId(null);
      setEditingTagName("");
      setEditingTagColor("");
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
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "タグの削除に失敗しました");
      }

      setSuccess("タグを削除しました");
      await fetchTags();
      onUpdate();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 学年作成
  const handleCreateGrade = async () => {
    if (!newGradeName.trim()) {
      setError("学年名を入力してください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGradeName.trim(),
          displayOrder: grades.length,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "学年の作成に失敗しました");
      }

      setSuccess("学年を作成しました");
      setNewGradeName("");
      await fetchGrades();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 学年更新
  const handleUpdateGrade = async (id: number) => {
    if (!editingGradeName.trim()) {
      setError("学年名を入力してください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const grade = grades.find((g) => g.id === id);
      const response = await fetch(`/api/grades/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingGradeName.trim(),
          displayOrder: grade?.display_order ?? 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "学年の更新に失敗しました");
      }

      setSuccess("学年を更新しました");
      setEditingGradeId(null);
      setEditingGradeName("");
      await fetchGrades();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 学年削除
  const handleDeleteGrade = async (id: number, name: string) => {
    if (!confirm(`「${name}」を削除してもよろしいですか？`)) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/grades/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "学年の削除に失敗しました");
      }

      setSuccess("学年を削除しました");
      await fetchGrades();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 科目作成
  const handleCreateSubject = async () => {
    if (!newSubjectName.trim()) {
      setError("科目名を入力してください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSubjectName.trim(),
          displayOrder: subjects.length,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "科目の作成に失敗しました");
      }

      setSuccess("科目を作成しました");
      setNewSubjectName("");
      await fetchSubjects();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 科目更新
  const handleUpdateSubject = async (id: number) => {
    if (!editingSubjectName.trim()) {
      setError("科目名を入力してください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const subject = subjects.find((s) => s.id === id);
      const response = await fetch(`/api/subjects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingSubjectName.trim(),
          displayOrder: subject?.display_order ?? 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "科目の更新に失敗しました");
      }

      setSuccess("科目を更新しました");
      setEditingSubjectId(null);
      setEditingSubjectName("");
      await fetchSubjects();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 科目削除
  const handleDeleteSubject = async (id: number, name: string) => {
    if (!confirm(`「${name}」を削除してもよろしいですか？`)) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/subjects/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "科目の削除に失敗しました");
      }

      setSuccess("科目を削除しました");
      await fetchSubjects();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // バックアップファイル読み込み
  const handleBackupFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBackupLoading(true);
    setError(null);
    setSuccess(null);
    setBackupTests([]);
    setSelectedTests(new Set());

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/backup/restore", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "バックアップファイルの読み込みに失敗しました"
        );
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
      setError("復元するテストを選択してください");
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
        const test = backupTests.find((t) => t.id === testId);
        if (!test) continue;

        try {
          const response = await fetch("/api/backup/restore-test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
        setBackupTests(backupTests.filter((t) => !selectedTests.has(t.id)));
      }

      if (errorCount > 0) {
        setError(`${errorCount}件の復元に失敗しました:\n${errors.join("\n")}`);
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
      setSelectedTests(new Set(backupTests.map((t) => t.id)));
    }
  };

  // バックアップ作成
  const handleCreateBackup = async () => {
    try {
      setError(null);
      setSuccess(null);

      // バックアップファイルをダウンロード
      const response = await fetch("/api/backup/create");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "バックアップの作成に失敗しました");
      }

      // ファイルをダウンロード
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // ファイル名を取得(レスポンスヘッダーから)
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch
        ? filenameMatch[1]
        : `backup-${new Date().toISOString()}.db`;

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess("バックアップを作成しました");
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
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900">管理者メニュー</h2>
            <a
              href="/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              title="ダッシュボードを開く"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              ダッシュボード
            </a>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* CSV出力ボタン */}
        {onExportCSV && (
          <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
            <button
              onClick={() => {
                onExportCSV();
                onClose();
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 justify-center"
              title="現在のフィルタ条件でCSVエクスポート"
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
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span className="font-medium">CSV出力</span>
            </button>
          </div>
        )}

        {/* タブ */}
        <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 h-12 flex-shrink-0">
          <button
            onClick={() => setActiveTab("folders")}
            className={`px-4 sm:px-6 h-full text-sm font-medium transition-colors whitespace-nowrap min-w-fit flex items-center ${
              activeTab === "folders"
                ? "text-primary border-b-2 border-primary bg-blue-50"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            フォルダ管理
          </button>
          <button
            onClick={() => setActiveTab("tags")}
            className={`px-4 sm:px-6 h-full text-sm font-medium transition-colors whitespace-nowrap min-w-fit flex items-center ${
              activeTab === "tags"
                ? "text-primary border-b-2 border-primary bg-blue-50"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            タグ管理
          </button>
          <button
            onClick={() => setActiveTab("grades")}
            className={`px-4 sm:px-6 h-full text-sm font-medium transition-colors whitespace-nowrap min-w-fit flex items-center ${
              activeTab === "grades"
                ? "text-primary border-b-2 border-primary bg-blue-50"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            学年管理
          </button>
          <button
            onClick={() => setActiveTab("subjects")}
            className={`px-4 sm:px-6 h-full text-sm font-medium transition-colors whitespace-nowrap min-w-fit flex items-center ${
              activeTab === "subjects"
                ? "text-primary border-b-2 border-primary bg-blue-50"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            科目管理
          </button>
          <button
            onClick={() => setActiveTab("restore")}
            className={`px-4 sm:px-6 h-full text-sm font-medium transition-colors whitespace-nowrap min-w-fit flex items-center ${
              activeTab === "restore"
                ? "text-primary border-b-2 border-primary bg-blue-50"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            バックアップ復元
          </button>
          <button
            onClick={() => setActiveTab("email")}
            className={`px-4 sm:px-6 h-full text-sm font-medium transition-colors whitespace-nowrap min-w-fit flex items-center gap-1 ${
              activeTab === "email"
                ? "text-primary border-b-2 border-primary bg-blue-50"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            📧 メール取込
            {emailPollerRunning && (
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="稼働中"></span>
            )}
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
          {activeTab === "folders" && (
            <div className="space-y-6">
              {/* フォルダ作成 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  新規フォルダ作成
                </h3>
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
                    value={newFolderParentId || ""}
                    onChange={(e) =>
                      setNewFolderParentId(
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loading}
                  >
                    <option value="">親フォルダなし(ルート)</option>
                    {folders
                      .filter((f) => f.id !== 1)
                      .map((folder) => (
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
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  フォルダ一覧
                </h3>
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
                            onChange={(e) =>
                              setEditingFolderName(e.target.value)
                            }
                            className="w-full px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                            disabled={loading}
                            maxLength={50}
                          />
                          <select
                            value={editingFolderParentId || ""}
                            onChange={(e) =>
                              setEditingFolderParentId(
                                e.target.value ? parseInt(e.target.value) : null
                              )
                            }
                            className="w-full px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                            disabled={loading}
                          >
                            <option value="">親フォルダなし(ルート)</option>
                            {folders
                              .filter((f) => f.id !== 1 && f.id !== folder.id)
                              .map((f) => (
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
                                setEditingFolderName("");
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
                            <span className="text-gray-900 font-medium">
                              {folder.name}
                            </span>
                            {folder.parent_id && (
                              <span className="ml-2 text-sm text-gray-500">
                                (
                                {
                                  folders.find((f) => f.id === folder.parent_id)
                                    ?.name
                                }
                                )
                              </span>
                            )}
                          </div>
                          {folder.id !== 1 && folder.name !== "未分類" && (
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
                                onClick={() =>
                                  handleDeleteFolder(folder.id, folder.name)
                                }
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

          {activeTab === "tags" && (
            <div className="space-y-6">
              {/* タグ作成 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  新規タグ作成
                </h3>
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
                            newTagColor === color
                              ? "ring-2 ring-offset-2 ring-gray-400"
                              : ""
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
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  タグ一覧
                </h3>
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
                              onChange={(e) =>
                                setEditingTagName(e.target.value)
                              }
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
                                    editingTagColor === color
                                      ? "ring-2 ring-offset-1 ring-gray-400"
                                      : ""
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
                                setEditingTagName("");
                                setEditingTagColor("");
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
                            <span className="text-gray-900 font-medium">
                              {tag.name}
                            </span>
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

          {activeTab === "grades" && (
            <div className="space-y-6">
              {/* 学年作成 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  新規学年追加
                </h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newGradeName}
                    onChange={(e) => setNewGradeName(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleCreateGrade()}
                    placeholder="学年名を入力（例: 高3、大学1年）"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <button
                    onClick={handleCreateGrade}
                    disabled={loading || !newGradeName.trim()}
                    className="px-6 py-2 bg-primary hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    追加
                  </button>
                </div>
              </div>

              {/* 学年一覧 */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  学年一覧
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {grades.map((grade) => (
                    <div
                      key={grade.id}
                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                    >
                      {editingGradeId === grade.id ? (
                        <div className="flex gap-2 flex-1">
                          <input
                            type="text"
                            value={editingGradeName}
                            onChange={(e) =>
                              setEditingGradeName(e.target.value)
                            }
                            onKeyPress={(e) =>
                              e.key === "Enter" && handleUpdateGrade(grade.id)
                            }
                            className="flex-1 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateGrade(grade.id)}
                            disabled={loading}
                            className="px-4 py-1 bg-primary hover:bg-blue-700 text-white rounded transition-colors text-sm disabled:opacity-50"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => {
                              setEditingGradeId(null);
                              setEditingGradeName("");
                            }}
                            className="px-4 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors text-sm"
                          >
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-gray-900 font-medium">
                            {grade.name}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingGradeId(grade.id);
                                setEditingGradeName(grade.name);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="編集"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteGrade(grade.id, grade.name)
                              }
                              disabled={loading}
                              className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                              title="削除"
                            >
                              <svg
                                className="w-4 h-4"
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
                        </>
                      )}
                    </div>
                  ))}
                  {grades.length === 0 && (
                    <p className="text-center text-gray-500 py-8">
                      学年が登録されていません
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "subjects" && (
            <div className="space-y-6">
              {/* 科目作成 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  新規科目追加
                </h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === "Enter" && handleCreateSubject()
                    }
                    placeholder="科目名を入力（例: 現代文、古典、漢文）"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <button
                    onClick={handleCreateSubject}
                    disabled={loading || !newSubjectName.trim()}
                    className="px-6 py-2 bg-primary hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    追加
                  </button>
                </div>
              </div>

              {/* 科目一覧 */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  科目一覧
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {subjects.map((subject) => (
                    <div
                      key={subject.id}
                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                    >
                      {editingSubjectId === subject.id ? (
                        <div className="flex gap-2 flex-1">
                          <input
                            type="text"
                            value={editingSubjectName}
                            onChange={(e) =>
                              setEditingSubjectName(e.target.value)
                            }
                            onKeyPress={(e) =>
                              e.key === "Enter" &&
                              handleUpdateSubject(subject.id)
                            }
                            className="flex-1 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateSubject(subject.id)}
                            disabled={loading}
                            className="px-4 py-1 bg-primary hover:bg-blue-700 text-white rounded transition-colors text-sm disabled:opacity-50"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => {
                              setEditingSubjectId(null);
                              setEditingSubjectName("");
                            }}
                            className="px-4 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors text-sm"
                          >
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-gray-900 font-medium">
                            {subject.name}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingSubjectId(subject.id);
                                setEditingSubjectName(subject.name);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="編集"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteSubject(subject.id, subject.name)
                              }
                              disabled={loading}
                              className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                              title="削除"
                            >
                              <svg
                                className="w-4 h-4"
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
                        </>
                      )}
                    </div>
                  ))}
                  {subjects.length === 0 && (
                    <p className="text-center text-gray-500 py-8">
                      科目が登録されていません
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "restore" && (
            <div className="space-y-6">
              {/* バックアップ作成 */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      バックアップ作成
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">
                      現在のデータベースをバックアップファイルとして保存します。定期的にバックアップを作成することをお勧めします。
                    </p>
                  </div>
                  <button
                    onClick={handleCreateBackup}
                    disabled={loading}
                    className="ml-4 px-6 py-2 bg-primary hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
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
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    バックアップ作成
                  </button>
                </div>
              </div>

              {/* バックアップファイル選択 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  バックアップから復元
                </h3>
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
                        {selectedTests.size === backupTests.length
                          ? "全解除"
                          : "全選択"}
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
                              <span className="font-medium text-gray-900">
                                {test.name}
                              </span>
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                {test.subject}
                              </span>
                              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                                {test.grade}
                              </span>
                            </div>
                            {test.description && (
                              <p className="text-sm text-gray-600 mb-2">
                                {test.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>📁 {test.folder_name || "未分類"}</span>
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
                                  作成日:{" "}
                                  {new Date(test.created_at).toLocaleDateString(
                                    "ja-JP"
                                  )}
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

          {/* メール設定タブ */}
          {activeTab === "email" && (
            <div className="space-y-6">
              {/* ステータス表示 */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📧</span>
                  <div>
                    <h3 className="font-medium text-gray-900">メール自動取込</h3>
                    <p className="text-sm text-gray-500">
                      {emailPollerRunning ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block"></span>
                          稼働中（IMAP IDLE接続）
                        </span>
                      ) : (
                        <span className="text-gray-400">停止中</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    取込: {emailStats.success}件 / エラー: {emailStats.error}件
                  </span>
                </div>
              </div>

              {/* IMAP接続設定 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  🔌 IMAP接続設定
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">IMAPホスト</label>
                    <input
                      type="text"
                      value={emailConfig.imap_host}
                      onChange={(e) => setEmailConfig({ ...emailConfig, imap_host: e.target.value })}
                      placeholder="imap.gmail.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">ポート</label>
                    <input
                      type="number"
                      value={emailConfig.imap_port}
                      onChange={(e) => setEmailConfig({ ...emailConfig, imap_port: parseInt(e.target.value) || 993 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">メールアドレス</label>
                    <input
                      type="email"
                      value={emailConfig.imap_user}
                      onChange={(e) => setEmailConfig({ ...emailConfig, imap_user: e.target.value })}
                      placeholder="example@gmail.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">アプリパスワード</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={emailConfig.imap_password}
                        onChange={(e) => setEmailConfig({ ...emailConfig, imap_password: e.target.value })}
                        placeholder="Googleアプリパスワード"
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? "🙈" : "👁"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={handleTestEmailConnection}
                    disabled={emailLoading || !emailConfig.imap_user}
                    className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {emailLoading ? "テスト中..." : "🔗 接続テスト"}
                  </button>
                  {emailTestResult && (
                    <span className={`text-sm ${emailTestResult.success ? "text-green-600" : "text-red-600"}`}>
                      {emailTestResult.success ? "✅ 接続OK" : `❌ ${emailTestResult.error}`}
                    </span>
                  )}
                </div>
              </div>

              {/* 有効/無効 */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">自動取込を有効にする</h4>
                  <p className="text-xs text-gray-500 mt-1">サーバー起動時にIMAP IDLE接続を開始し、新着メールを自動処理します</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailConfig.enabled === 1}
                    onChange={(e) => setEmailConfig({ ...emailConfig, enabled: e.target.checked ? 1 : 0 })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {/* 自動登録の初期値設定 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  ⚙️ 自動登録の初期値
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">テスト名プレフィックス</label>
                    <input
                      type="text"
                      value={emailConfig.name_prefix}
                      onChange={(e) => setEmailConfig({ ...emailConfig, name_prefix: e.target.value })}
                      placeholder="[自動登録]"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">タグ名</label>
                    <input
                      type="text"
                      value={emailConfig.default_tag_name}
                      onChange={(e) => setEmailConfig({ ...emailConfig, default_tag_name: e.target.value })}
                      placeholder="自動登録"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">科目</label>
                    <select
                      value={emailConfig.default_subject}
                      onChange={(e) => setEmailConfig({ ...emailConfig, default_subject: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="未分類">未分類</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">学年</label>
                    <select
                      value={emailConfig.default_grade}
                      onChange={(e) => setEmailConfig({ ...emailConfig, default_grade: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="未設定">未設定</option>
                      {grades.map((g) => (
                        <option key={g.id} value={g.name}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">保存先フォルダ</label>
                    <select
                      value={emailConfig.default_folder_id || ""}
                      onChange={(e) => setEmailConfig({ ...emailConfig, default_folder_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">未分類（デフォルト）</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* ボタン */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveEmailConfig}
                  disabled={emailLoading}
                  className="flex-1 px-4 py-2.5 bg-primary hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 font-medium text-sm"
                >
                  {emailLoading ? "保存中..." : "💾 設定を保存"}
                </button>
                <button
                  onClick={handleManualFetch}
                  disabled={emailLoading || !emailConfig.imap_user}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50 font-medium text-sm"
                >
                  {emailLoading ? "取込中..." : "📥 今すぐ取込"}
                </button>
              </div>

              {/* 取込ログ */}
              {emailImportLogs.length > 0 && (
                <div className="border border-gray-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-700 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                    📋 取込ログ（最新20件）
                  </h4>
                  <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {emailImportLogs.map((log) => (
                      <div key={log.id} className="px-4 py-2.5 text-sm flex items-center gap-3">
                        <span className={log.status === "success" ? "text-green-500" : "text-red-500"}>
                          {log.status === "success" ? "✅" : "❌"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-gray-900">{log.file_name}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {log.from_address} | {log.subject}
                          </div>
                          {log.error_message && (
                            <div className="text-xs text-red-500 truncate">{log.error_message}</div>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {new Date(log.imported_at).toLocaleString("ja-JP", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
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
