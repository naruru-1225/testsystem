import TestEditForm from "@/components/TestEditForm";

/**
 * テスト編集ページ
 * パス: /tests/[id]/edit
 */
interface EditTestPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditTestPage({ params }: EditTestPageProps) {
  const { id } = await params;
  const testId = parseInt(id);

  if (isNaN(testId)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            無効なテストID
          </h1>
          <p className="text-gray-600">指定されたテストが見つかりません</p>
        </div>
      </div>
    );
  }

  return <TestEditForm testId={testId} />;
}
