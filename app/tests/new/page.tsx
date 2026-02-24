import TestCreateForm from "@/components/TestCreateForm";

interface NewTestPageProps {
  searchParams: Promise<{
    pdfPath?: string;
    name?: string;
    inboxItemId?: string;
  }>;
}

/**
 * テスト新規登録ページ
 * パス: /tests/new
 * クエリパラメータ:
 *   - pdfPath: 受信トレイから引き継ぐPDFパス
 *   - name: テスト名候補（メールの件名）
 *   - inboxItemId: 受信トレイアイテムID
 */
export default async function NewTestPage({ searchParams }: NewTestPageProps) {
  const { pdfPath, name, inboxItemId } = await searchParams;

  return (
    <TestCreateForm
      initialPdfPath={pdfPath}
      initialName={name}
      inboxItemId={inboxItemId ? parseInt(inboxItemId) : undefined}
    />
  );
}
