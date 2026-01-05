import { NextResponse } from "next/server";
import { testRepository } from "@/lib/repositories/testRepository";
import { folderRepository } from "@/lib/repositories/folderRepository";
import { withErrorHandling, validationError } from "@/lib/api-utils";
import db from "@/lib/db/db-instance"; // For uncategorized folder check if needed, or use repository

/**
 * テスト一覧取得API
 * GET /api/tests
 * クエリパラメータ:
 *   - folderId: フォルダIDでフィルタ(子孫フォルダも含む)
 *   - grade: 学年でフィルタ
 *   - subject: 科目でフィルタ
 *   - tagId: タグIDでフィルタ
 *   - search: テスト名、科目、学年での検索
 */
export const GET = withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId");
  const grade = searchParams.get("grade");
  const subject = searchParams.get("subject");
  const tagId = searchParams.get("tagId");
  const search = searchParams.get("search");

  const filters = {
    folderId: folderId ? parseInt(folderId) : undefined,
    grade: grade || undefined,
    subject: subject || undefined,
    tagId: tagId ? parseInt(tagId) : undefined,
    search: search || undefined,
  };

  const tests = testRepository.getAll(filters);
  return NextResponse.json(tests);
});

/**
 * テスト新規作成API
 * POST /api/tests
 * リクエストボディ:
 *   - name: テスト名
 *   - subject: 科目
 *   - grade: 学年
 *   - folderId: フォルダID
 *   - tagIds: タグIDの配列
 *   - pdfPath: PDFファイルパス(任意)
 *   - attachmentPaths: 添付PDFパスの配列(任意)
 *   - attachmentFileNames: 添付PDFファイル名の配列(任意)
 */
export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json();
  let {
    name,
    subject,
    grade,
    folderIds = [], // 配列として受け取る
    tagIds = [],
    pdfPath = null,
    attachmentPaths = [], // 添付PDFパスの配列
    attachmentFileNames = [], // 添付PDFファイル名の配列
    description = null,
    totalQuestions = null,
    totalScore = null,
  } = body;

  // バリデーション
  if (!name || !subject || !grade) {
    return validationError("必須項目が入力されていません");
  }

  // フォルダ処理ロジック
  const uncategorizedFolder = folderRepository.getUncategorized();
  const uncategorizedId = uncategorizedFolder?.id || 2; // デフォルトID=2

  if (folderIds.length === 0) {
    if (uncategorizedFolder) {
      folderIds = [uncategorizedId];
    }
  } else if (uncategorizedFolder) {
    // 未分類以外のフォルダが選択されている場合は、未分類フォルダを除外
    folderIds = folderIds.filter((id: number) => id !== uncategorizedId);
    
    // 除外後に空になった場合は、未分類フォルダを再度追加
    if (folderIds.length === 0) {
      folderIds = [uncategorizedId];
    }
  }

  // 添付ファイルの整形
  const attachments = attachmentPaths.map((path: string, index: number) => ({
    filePath: path,
    fileName: attachmentFileNames[index] || `attachment_${index + 1}.pdf`
  }));

  const newTest = testRepository.create({
    name,
    subject,
    grade,
    folderId: folderIds[0], // メインフォルダ
    description,
    pdfPath,
    tagIds,
    folderIds,
    totalQuestions,
    totalScore,
    attachments
  });

  return NextResponse.json(newTest, { status: 201 });
});
