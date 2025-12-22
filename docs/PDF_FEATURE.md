# PDF 機能実装ガイド

このドキュメントでは、テスト管理システムに実装された PDF 機能について説明します。

## 📋 目次

1. [実装された機能](#実装された機能)
2. [使い方](#使い方)
3. [技術仕様](#技術仕様)
4. [ファイル構成](#ファイル構成)

---

## 実装された機能

### 1. PDF ファイルのアップロード

- テスト作成・編集時に PDF ファイルをアップロード可能
- ファイル形式: PDF (.pdf)
- ファイルサイズ制限: 最大 10MB
- ドラッグ&ドロップ対応の UI

### 2. PDF プレビュー

- テスト一覧から「PDF」ボタンをクリックして閲覧
- フルスクリーンモーダルでの表示
- ページナビゲーション機能
- ズーム機能(50%〜300%)
- レスポンシブデザイン対応

### 3. PDF 印刷

- プレビュー画面から直接印刷
- ブラウザの印刷ダイアログを使用
- 複数ページの一括印刷対応

---

## 使い方

### テスト作成時に PDF をアップロード

1. **新規テスト登録**ページを開く
2. フォーム下部の「PDF ファイル」セクションを確認
3. 点線のエリアをクリック、または PDF ファイルをドラッグ&ドロップ
4. アップロードが完了すると緑色の確認表示
5. 削除する場合は、ゴミ箱アイコンをクリック
6. 他の情報を入力して「登録する」をクリック

### テスト編集時に PDF を変更

1. テスト一覧から**編集**をクリック
2. 既存の PDF がある場合は表示される
3. 新しい PDF をアップロードする場合:
   - 「削除」ボタンで既存 PDF を削除
   - 新しい PDF ファイルを選択してアップロード
4. 「更新する」をクリックして保存

### PDF をプレビュー

1. テスト一覧で、PDF があるテストには**PDF**ボタンが表示
2. PDF ボタンをクリックすると、モーダルが開く
3. プレビュー画面の操作:
   - **ページ移動**: 左右の矢印ボタン
   - **ズーム**: 虫眼鏡アイコン(拡大/縮小)、または「100%」ボタンでリセット
   - **印刷**: 右上の「印刷」ボタン
   - **閉じる**: 右上の「×」ボタン

### PDF を印刷

1. PDF プレビューを開く
2. 右上の「印刷」ボタンをクリック
3. ブラウザの印刷ダイアログが表示される
4. プリンターを選択し、印刷設定を調整
5. 印刷を実行

---

## 技術仕様

### ライブラリ

- **react-pdf 9.1.1**: PDF レンダリング
- **pdfjs-dist**: PDF.js コアライブラリ(react-pdf の依存関係)

### データベーススキーマ

```sql
ALTER TABLE tests ADD COLUMN pdf_path TEXT;
```

- `pdf_path`: PDF ファイルのパブリックパス(例: `/uploads/pdfs/1234567890_abc123.pdf`)
- NULL 許可(PDF は任意)

### ファイル保存

**保存先**: `public/uploads/pdfs/`

**ファイル名形式**: `{timestamp}_{random}.pdf`

- 例: `1704067200000_a1b2c3d4e5.pdf`
- タイムスタンプで重複を防止
- ランダム文字列で一意性を確保

**アクセス URL**: `http://localhost:3000/uploads/pdfs/{filename}.pdf`

### API エンドポイント

#### 1. PDF アップロード

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

#### 2. テスト作成(PDF 含む)

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

#### 3. テスト更新(PDF 含む)

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
- ファイルサイズチェック: 10MB 以下
- ファイル名のサニタイズ: タイムスタンプ+ランダム文字列

**フォーム送信時**:

- PDF は任意項目
- PDF パスが指定された場合、データベースに保存

---

## ファイル構成

### コンポーネント

#### 1. `components/PdfViewer.tsx`

PDF プレビュー用モーダルコンポーネント

**機能**:

- PDF 表示(react-pdf 使用)
- ページナビゲーション
- ズーム機能(50%〜300%)
- 印刷機能
- ローディング・エラー表示

**Props**:

```typescript
interface PdfViewerProps {
  pdfUrl: string; // PDFのURL
  onClose: () => void; // 閉じるボタンのハンドラ
}
```

#### 2. `components/TestCreateForm.tsx`

テスト作成フォーム(PDF 機能拡張)

**追加 State**:

```typescript
const [pdfFile, setPdfFile] = useState<File | null>(null);
const [pdfPath, setPdfPath] = useState<string | null>(null);
const [uploadingPdf, setUploadingPdf] = useState(false);
```

**追加関数**:

- `handlePdfChange`: ファイル選択時の処理
- `uploadPdf`: PDF アップロード処理
- `handleRemovePdf`: PDF 削除

#### 3. `components/TestEditForm.tsx`

テスト編集フォーム(PDF 機能拡張)

TestCreateForm と同じ PDF 機能を実装。
既存 PDF がある場合は初期表示。

#### 4. `components/TestList.tsx`

テスト一覧(PDF 機能拡張)

**追加 State**:

```typescript
const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
```

**追加機能**:

- PDF ボタンの表示(pdf_path が存在する場合のみ)
- PDF プレビューモーダルの表示/非表示

### API

#### `app/api/upload/route.ts`

PDF ファイルアップロード API

**処理フロー**:

1. FormData からファイル取得
2. ファイル形式チェック(PDF)
3. ファイルサイズチェック(10MB)
4. ファイル名生成(タイムスタンプ+ランダム)
5. `public/uploads/pdfs/`に保存
6. パブリックパスを返却

#### `app/api/tests/route.ts`

テスト CRUD API(POST 更新)

**変更点**:

- `pdfPath`パラメータ追加
- INSERT 文に`pdf_path`カラム追加

#### `app/api/tests/[id]/route.ts`

個別テスト API(PUT 更新)

**変更点**:

- `pdfPath`パラメータ追加
- UPDATE 文に`pdf_path`カラム追加

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
  pdf_path: string | null; // 追加
  created_at: string;
  updated_at: string;
}
```

---

## トラブルシューティング

### PDF が表示されない

**原因**:

- ファイルパスが不正
- PDF ファイルが破損
- ブラウザの PDF 表示が無効

**対処法**:

1. ブラウザのコンソールでエラー確認
2. `public/uploads/pdfs/`にファイルが存在するか確認
3. 別のブラウザで試す

### アップロードが失敗する

**原因**:

- ファイルサイズが 10MB を超えている
- PDF ファイル以外のファイル
- サーバーの書き込み権限エラー

**対処法**:

1. ファイルサイズを確認(10MB 以下)
2. PDF ファイルであることを確認
3. `public/uploads/pdfs/`の書き込み権限を確認

### 印刷ができない

**原因**:

- ブラウザの印刷機能が無効
- PDF が正しく読み込まれていない

**対処法**:

1. PDF プレビューが正しく表示されるか確認
2. ブラウザの印刷設定を確認
3. PDF を直接開いて印刷を試す(PDF ボタン → 新しいタブで開く)

---

## セキュリティ考慮事項

### ファイルアップロード

1. **ファイル形式制限**: `application/pdf`のみ許可
2. **ファイルサイズ制限**: 10MB 以下
3. **ファイル名サニタイズ**: オリジナル名を使わず、タイムスタンプ+ランダム文字列
4. **保存場所**: `public/uploads/pdfs/`に分離

### アクセス制御

現在の実装では、アップロードされた PDF は誰でも URL でアクセス可能です。
将来的に認証機能を追加する場合は、以下を検討してください:

- PDF ファイルを`public/`外に保存
- API を通して PDF を配信
- セッション認証によるアクセス制限

---

## 今後の拡張案

1. **複数 PDF アップロード**: テストに複数の PDF を紐付け
2. **PDF サムネイル**: 一覧画面でサムネイル表示
3. **PDF 編集**: 注釈やハイライト機能
4. **バージョン管理**: PDF の履歴管理
5. **一括ダウンロード**: 複数テストの PDF を ZIP でダウンロード
6. **OCR 機能**: PDF からテキスト抽出
7. **プレビュー共有**: 特定の PDF への共有リンク生成

---

## まとめ

PDF アップロード、プレビュー、印刷機能が正常に実装されました。

**主な機能**:
✅ PDF ファイルのアップロード(最大 10MB)
✅ PDF プレビュー(ページナビゲーション、ズーム)
✅ PDF 印刷機能
✅ テスト作成・編集時の PDF 管理
✅ テスト一覧からの PDF 表示

**技術スタック**:

- react-pdf 9.1.1
- Next.js 15.5.6 API Routes
- SQLite (pdf_path カラム追加)
- TypeScript

アプリケーションは `http://localhost:3000` で動作中です。
新規テスト登録やテスト編集画面で、PDF 機能をお試しください!
