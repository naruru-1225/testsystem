/**
 * データベース型定義
 */

// テストデータの型
export interface Test {
  id: number;
  name: string; // テスト名
  subject: string; // 科目
  grade: string; // 学年
  folder_id: number; // フォルダID
  pdf_path: string | null; // PDFファイルパス
  description: string | null; // 自由記入欄
  total_questions: number | null; // 大問数
  total_score: number | null; // 満点
  created_at: string; // 登録日
  updated_at: string; // 更新日
}

// フォルダデータの型
export interface Folder {
  id: number;
  name: string; // フォルダ名
  parent_id: number | null; // 親フォルダID
  created_at: string; // 作成日
}

// タグデータの型
export interface Tag {
  id: number;
  name: string; // タグ名
  color: string; // タグの色
}

// テストとタグの関連付け
export interface TestTag {
  id: number;
  test_id: number; // テストID
  tag_id: number; // タグID
}

// テストとフォルダの関連付け
export interface TestFolder {
  id: number;
  test_id: number; // テストID
  folder_id: number; // フォルダID
}

// テスト一覧表示用の拡張型
export interface TestWithTags extends Test {
  tags: Tag[]; // 関連するタグの配列
  folders: Folder[]; // 関連するフォルダの配列
  folder_name: string; // 主フォルダ名(後方互換のため保持)
}
