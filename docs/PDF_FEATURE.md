# PDF機能実装ガイド

このドキュメントでは、テスト管理システムに実装されたPDF機能について説明します。

## 📋 目次

1. [実装された機能](#実装された機能)
2. [使い方](#使い方)
3. [技術仕様](#技術仕様)
4. [ファイル構成](#ファイル構成)

---

## 実装された機能

### 1. PDFファイルのアップロード
- テスト作成・編集時にPDFファイルをアップロード可能
- ファイル形式: PDF (.pdf)
- ファイルサイズ制限: 最大10MB
- ドラッグ&ドロップ対応のUI

### 2. PDFプレビュー
- テスト一覧から「PDF」ボタンをクリックして閲覧
- フルスクリーンモーダルでの表示
- ページナビゲーション機能
- ズーム機能(50%〜300%)
- レスポンシブデザイン対応

### 3. PDF印刷
- プレビュー画面から直接印刷
- ブラウザの印刷ダイアログを使用
- 複数ページの一括印刷対応

---

## 使い方

### テスト作成時にPDFをアップロード

1. **新規テスト登録**ページを開く
2. フォーム下部の「PDFファイル」セクションを確認
3. 点線のエリアをクリック、またはPDFファイルをドラッグ&ドロップ
4. アップロードが完了すると緑色の確認表示
5. 削除する場合は、ゴミ箱アイコンをクリック
6. 他の情報を入力して「登録する」をクリック

### テスト編集時にPDFを変更

1. テスト一覧から**編集**をクリック
2. 既存のPDFがある場合は表示される
3. 新しいPDFをアップロードする場合:
   - 「削除」ボタンで既存PDFを削除
   - 新しいPDFファイルを選択してアップロード
4. 「更新する」をクリックして保存

### PDFをプレビュー

1. テスト一覧で、PDFがあるテストには**PDF**ボタンが表示
2. PDFボタンをクリックすると、モーダルが開く
3. プレビュー画面の操作:
   - **ページ移動**: 左右の矢印ボタン
   - **ズーム**: 虫眼鏡アイコン(拡大/縮小)、または「100%」ボタンでリセット
   - **印刷**: 右上の「印刷」ボタン
   - **閉じる**: 右上の「×」ボタン

### PDFを印刷

1. PDFプレビューを開く
2. 右上の「印刷」ボタンをクリック
3. ブラウザの印刷ダイアログが表示される
4. プリンターを選択し、印刷設定を調整
5. 印刷を実行

---

## 技術仕様

### ライブラリ

- **react-pdf 9.1.1**: PDFレンダリング
- **pdfjs-dist**: PDF.jsコアライブラリ(react-pdfの依存関係)

### データベーススキーマ

```sql
ALTER TABLE tests ADD COLUMN pdf_path TEXT;
```

- `pdf_path`: PDFファイルのパブリックパス(例: `/uploads/pdfs/1234567890_abc123.pdf`)
- NULL許可(PDFは任意)

### ファイル保存

**保存先**: `public/uploads/pdfs/`

**ファイル名形式**: `{timestamp}_{random}.pdf`
- 例: `1704067200000_a1b2c3d4e5.pdf`
- タイムスタンプで重複を防止
- ランダム文字列で一意性を確保

**アクセスURL**: `http://localhost:3000/uploads/pdfs/{filename}.pdf`

### API エンドポイント

#### 1. PDFアップロード
```
POST /api/upload
Content-Type: multipart/form-data

Request:
- file: File (PDFファイル)

Response:
{
  "path": "/uploads/pdfs/1234567890_abc123.pdf"
}

Errors:
- 400: ファイルなし、PDFファイル以外、10MB超過
- 500: サーバーエラー
```

#### 2. テスト作成(PDF含む)
```
POST /api/tests
Content-Type: application/json

Request:
{
  "name": "テスト名",
  "subject": "数学",
  "grade": "中1",
  "folderId": 1,
  "tagIds": [1, 2],
  "pdfPath": "/uploads/pdfs/1234567890_abc123.pdf"  // 任意
}
```

#### 3. テスト更新(PDF含む)
```
PUT /api/tests/[id]
Content-Type: application/json

Request:
{
  "name": "テスト名",
  "subject": "数学",
  "grade": "中1",
  "folderId": 1,
  "tagIds": [1, 2],
  "pdfPath": "/uploads/pdfs/1234567890_abc123.pdf"  // 任意
}
```

### バリデーション

**アップロード時**:
- ファイル形式チェック: `application/pdf`のみ許可
- ファイルサイズチェック: 10MB以下
- ファイル名のサニタイズ: タイムスタンプ+ランダム文字列

**フォーム送信時**:
- PDFは任意項目
- PDFパスが指定された場合、データベースに保存

---

## ファイル構成

### コンポーネント

#### 1. `components/PdfViewer.tsx`
PDFプレビュー用モーダルコンポーネント

**機能**:
- PDF表示(react-pdf使用)
- ページナビゲーション
- ズーム機能(50%〜300%)
- 印刷機能
- ローディング・エラー表示

**Props**:
```typescript
interface PdfViewerProps {
  pdfUrl: string;      // PDFのURL
  onClose: () => void; // 閉じるボタンのハンドラ
}
```

#### 2. `components/TestCreateForm.tsx`
テスト作成フォーム(PDF機能拡張)

**追加State**:
```typescript
const [pdfFile, setPdfFile] = useState<File | null>(null);
const [pdfPath, setPdfPath] = useState<string | null>(null);
const [uploadingPdf, setUploadingPdf] = useState(false);
```

**追加関数**:
- `handlePdfChange`: ファイル選択時の処理
- `uploadPdf`: PDFアップロード処理
- `handleRemovePdf`: PDF削除

#### 3. `components/TestEditForm.tsx`
テスト編集フォーム(PDF機能拡張)

TestCreateFormと同じPDF機能を実装。
既存PDFがある場合は初期表示。

#### 4. `components/TestList.tsx`
テスト一覧(PDF機能拡張)

**追加State**:
```typescript
const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
```

**追加機能**:
- PDFボタンの表示(pdf_pathが存在する場合のみ)
- PDFプレビューモーダルの表示/非表示

### API

#### `app/api/upload/route.ts`
PDFファイルアップロードAPI

**処理フロー**:
1. FormDataからファイル取得
2. ファイル形式チェック(PDF)
3. ファイルサイズチェック(10MB)
4. ファイル名生成(タイムスタンプ+ランダム)
5. `public/uploads/pdfs/`に保存
6. パブリックパスを返却

#### `app/api/tests/route.ts`
テストCRUD API(POST更新)

**変更点**:
- `pdfPath`パラメータ追加
- INSERT文に`pdf_path`カラム追加

#### `app/api/tests/[id]/route.ts`
個別テストAPI(PUT更新)

**変更点**:
- `pdfPath`パラメータ追加
- UPDATE文に`pdf_path`カラム追加

### データベース

#### `lib/database.ts`
データベース初期化(スキーマ更新)

**変更点**:
```typescript
CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  folder_id INTEGER NOT NULL,
  pdf_path TEXT,  // 追加
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
)
```

### 型定義

#### `types/database.ts`

**変更点**:
```typescript
export interface Test {
  id: number;
  name: string;
  subject: string;
  grade: string;
  folder_id: number;
  pdf_path: string | null;  // 追加
  created_at: string;
  updated_at: string;
}
```

---

## トラブルシューティング

### PDFが表示されない

**原因**:
- ファイルパスが不正
- PDFファイルが破損
- ブラウザのPDF表示が無効

**対処法**:
1. ブラウザのコンソールでエラー確認
2. `public/uploads/pdfs/`にファイルが存在するか確認
3. 別のブラウザで試す

### アップロードが失敗する

**原因**:
- ファイルサイズが10MBを超えている
- PDFファイル以外のファイル
- サーバーの書き込み権限エラー

**対処法**:
1. ファイルサイズを確認(10MB以下)
2. PDFファイルであることを確認
3. `public/uploads/pdfs/`の書き込み権限を確認

### 印刷ができない

**原因**:
- ブラウザの印刷機能が無効
- PDFが正しく読み込まれていない

**対処法**:
1. PDFプレビューが正しく表示されるか確認
2. ブラウザの印刷設定を確認
3. PDFを直接開いて印刷を試す(PDFボタン → 新しいタブで開く)

---

## セキュリティ考慮事項

### ファイルアップロード

1. **ファイル形式制限**: `application/pdf`のみ許可
2. **ファイルサイズ制限**: 10MB以下
3. **ファイル名サニタイズ**: オリジナル名を使わず、タイムスタンプ+ランダム文字列
4. **保存場所**: `public/uploads/pdfs/`に分離

### アクセス制御

現在の実装では、アップロードされたPDFは誰でもURLでアクセス可能です。
将来的に認証機能を追加する場合は、以下を検討してください:

- PDFファイルを`public/`外に保存
- APIを通してPDFを配信
- セッション認証によるアクセス制限

---

## 今後の拡張案

1. **複数PDFアップロード**: テストに複数のPDFを紐付け
2. **PDFサムネイル**: 一覧画面でサムネイル表示
3. **PDF編集**: 注釈やハイライト機能
4. **バージョン管理**: PDFの履歴管理
5. **一括ダウンロード**: 複数テストのPDFをZIPでダウンロード
6. **OCR機能**: PDFからテキスト抽出
7. **プレビュー共有**: 特定のPDFへの共有リンク生成

---

## まとめ

PDFアップロード、プレビュー、印刷機能が正常に実装されました。

**主な機能**:
✅ PDFファイルのアップロード(最大10MB)
✅ PDFプレビュー(ページナビゲーション、ズーム)
✅ PDF印刷機能
✅ テスト作成・編集時のPDF管理
✅ テスト一覧からのPDF表示

**技術スタック**:
- react-pdf 9.1.1
- Next.js 15.5.6 API Routes
- SQLite (pdf_pathカラム追加)
- TypeScript

アプリケーションは `http://localhost:3000` で動作中です。
新規テスト登録やテスト編集画面で、PDF機能をお試しください!
