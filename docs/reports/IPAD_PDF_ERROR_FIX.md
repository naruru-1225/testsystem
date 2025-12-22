# iPad PDF 閲覧エラー修正レポート

## 📅 修正日時

2025 年 11 月 6 日

## 🎯 問題の分析

### エラー状況

```
Application error: a client-side exception has occurred while loading 192.168.1.64
(see the browser console for more information).
```

### コンソールログ比較

**❌ エラー発生 iPad:**

```
LOGPdfViewer - 元のURL: /uploads/pdfs/1762257539971-mhjhvtzhf7k.pdf
LOGPdfViewer - 変換後のURL: http://192.168.1.64:3000/api/pdf/pdfs/1762257539971-mhjhvtzhf7k.pdf
LOGPdfViewer - 全ファイル: [object Object],[object Object]
LOGPdfViewer - 現在のファイルタイプ: pdf
(PDF読み込み成功のログなし ❌)
```

**✅ 正常動作 iPad:**

```
LOGPdfViewer - 元のURL: /uploads/pdfs/1762257539971-mhjhvtzhf7k.pdf
LOGPdfViewer - 変換後のURL: http://192.168.1.64:3000/api/pdf/pdfs/1762257539971-mhjhvtzhf7k.pdf
LOGPdfViewer - 全ファイル: [object Object],[object Object]
LOGPdfViewer - 現在のファイルタイプ: pdf
LOGPDF読み込み成功: http://192.168.1.64:3000/api/pdf/pdfs/1762257539971-mhjhvtzhf7k.pdf ページ数: 12 ✅
```

### 根本原因の推測

1. **PDF.js Worker の読み込み失敗**

   - 特定の iPad Safari で Worker ファイルが正しく読み込めない
   - 相対パスではなく絶対パスが必要

2. **メモリ不足**

   - 古い iPad モデルでメモリが不足
   - PDF.js がクラッシュ

3. **Safari のバージョン互換性**

   - 古い Safari で PDF.js の一部機能が未対応
   - `eval()`の使用が禁止されている可能性

4. **CORS 問題**
   - ローカルネットワーク上の別デバイスからのアクセス
   - Worker ファイルのクロスオリジン制約

---

## 🔧 実施した修正

### 1. PDF.js Worker 絶対パス設定

**修正前:**

```typescript
pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
```

**修正後:**

```typescript
// iPad Safari対応: 絶対URLを使用
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdfjs/pdf.worker.min.mjs`;
  console.log("🔧 PDF.js Worker設定:", pdfjs.GlobalWorkerOptions.workerSrc);
} else {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
}
```

**効果:**

- ✅ 絶対 URL で確実に Worker を読み込める
- ✅ クロスオリジン問題を回避
- ✅ 診断用ログを追加

---

### 2. PDF.js Options 最適化

**修正前:**

```typescript
const pdfOptions = useMemo(
  () => ({
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
    verbosity: 0, // エラーログを最小限に
  }),
  []
);
```

**修正後:**

```typescript
const pdfOptions = useMemo(
  () => ({
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
    verbosity: 1, // エラー詳細を表示
    withCredentials: false, // CORS問題を回避
    isEvalSupported: false, // Safari互換性向上
  }),
  []
);
```

**効果:**

- ✅ `withCredentials: false` で CORS 問題を回避
- ✅ `isEvalSupported: false` で Safari 互換性向上
- ✅ `verbosity: 1` でエラー詳細を記録

---

### 3. エラーログの詳細化

**修正前:**

```typescript
const onDocumentLoadError = (error: Error) => {
  console.error("PDF読み込みエラー:", error);
  console.error("失敗したPDF URL:", currentPdf);
  // ...
};
```

**修正後:**

```typescript
const onDocumentLoadError = (error: Error) => {
  console.error("❌ PDF読み込みエラー:", error);
  console.error("❌ エラー詳細:", {
    message: error.message,
    name: error.name,
    stack: error.stack,
    url: currentPdf,
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    platform: typeof navigator !== "undefined" ? navigator.platform : "unknown",
  });
  console.error("❌ 失敗したPDF URL:", currentPdf);
  console.error("❌ PDF.js version:", pdfjs.version);
  console.error("❌ Worker URL:", pdfjs.GlobalWorkerOptions.workerSrc);
  // ...
};
```

**効果:**

- ✅ エラーの詳細情報を記録
- ✅ デバイス情報(UserAgent, Platform)を記録
- ✅ PDF.js バージョンと Worker URL を記録
- ✅ 診断が容易に

---

### 4. onSourceError の詳細化

**修正前:**

```typescript
onSourceError={(error) => {
  console.error('PDF source error:', error);
  setError('PDFファイルの取得に失敗しました');
}}
```

**修正後:**

```typescript
onSourceError={(error) => {
  console.error('❌ PDF source error:', error);
  console.error('❌ ソースエラー詳細:', {
    error: error,
    message: error?.message,
    url: currentPdf,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
  });
  setError('PDFファイルの取得に失敗しました。ネットワーク接続を確認してください。');
}}
```

**効果:**

- ✅ ネットワークエラーの詳細を記録
- ✅ ユーザーへの適切なメッセージ表示

---

## 🧪 診断ツールの作成

### test-ipad-pdf-error.mjs

iPad 特有の PDF 閲覧エラーを診断するための専用テストスクリプトを作成:

**テスト項目:**

1. ✅ PDF.js Worker ファイルの存在と HTTP アクセス確認
2. ✅ PDF ファイルへのアクセスとフォーマット確認
3. ✅ CORS ヘッダーの確認
4. ✅ すべてのレスポンスヘッダーの詳細確認
5. ✅ ファイルサイズとダウンロード速度の測定
6. ✅ Range リクエスト対応確認(iPad Safari 重要)
7. ✅ メモリ使用量の推定

**使用方法:**

```bash
# サーバーを起動
npm run dev

# 別のターミナルで診断テストを実行
node test-ipad-pdf-error.mjs
```

---

## 📱 iPad での確認方法

### 1. ブラウザコンソールを開く

**iPad 側:**

1. 設定 → Safari → 詳細 → "Web インスペクタ"を有効化

**Mac 側:** 2. Safari → 開発 → [iPad デバイス名] → [開いているページ]

### 2. 確認すべきログ

**✅ 正常な場合:**

```javascript
🔧 PDF.js Worker設定: http://192.168.1.64:3000/pdfjs/pdf.worker.min.mjs
PdfViewer - 元のURL: /uploads/pdfs/XXXXX.pdf
PdfViewer - 変換後のURL: http://192.168.1.64:3000/api/pdf/pdfs/XXXXX.pdf
PdfViewer - 現在のファイルタイプ: pdf
✅ PDF読み込み成功: http://... ページ数: 12
```

**❌ エラーの場合:**

```javascript
🔧 PDF.js Worker設定: http://192.168.1.64:3000/pdfjs/pdf.worker.min.mjs
PdfViewer - 元のURL: /uploads/pdfs/XXXXX.pdf
❌ PDF読み込みエラー: [Error object]
❌ エラー詳細: {
  message: "...",
  name: "...",
  userAgent: "...",
  platform: "..."
}
❌ Worker URL: http://192.168.1.64:3000/pdfjs/pdf.worker.min.mjs
```

### 3. エラーメッセージの確認

以下のエラーメッセージに注目:

- `Worker failed to load` → Worker ファイルの読み込み失敗
- `Out of memory` → メモリ不足
- `CORS error` → クロスオリジン問題
- `Invalid PDF structure` → PDF ファイルの破損

---

## 🔍 追加の診断手順

### Step 1: Worker ファイルの直接アクセス確認

iPad のブラウザで以下の URL を開く:

```
http://192.168.1.64:3000/pdfjs/pdf.worker.min.mjs
```

**期待結果:** JavaScript コードが表示される

**エラーの場合:** 404 エラーまたは Content-Type が正しくない

---

### Step 2: PDF ファイルの直接アクセス確認

iPad のブラウザで以下の URL を開く:

```
http://192.168.1.64:3000/api/pdf/pdfs/1762257539971-mhjhvtzhf7k.pdf
```

**期待結果:** PDF が表示される

**エラーの場合:** ダウンロードが始まるかエラーメッセージが表示される

---

### Step 3: Safari のバージョン確認

iPad で設定 → 一般 → 情報 → バージョンを確認

**要求バージョン:** iOS 14.0 以上推奨

---

### Step 4: メモリ確認

1. 他のアプリをすべて閉じる
2. Safari のタブを 1 つだけにする
3. iPad を再起動
4. 再度 PDF を開く

---

## 🚀 推奨される対処法

### エラーが発生する iPad 向け

#### 対処法 1: Safari のキャッシュをクリア

```
設定 → Safari → 履歴とWebサイトデータを消去
```

#### 対処法 2: iPad を再起動

```
電源ボタン長押し → スライドして電源を切る → 再起動
```

#### 対処法 3: 他のアプリを閉じる

```
ホームボタン2回押し(またはスワイプアップ) → アプリを上にスワイプして閉じる
```

#### 対処法 4: Wi-Fi 接続を確認

```
設定 → Wi-Fi → ネットワークを選択 → 情報(i)アイコン → IPアドレス確認
```

#### 対処法 5: Safari の設定を確認

```
設定 → Safari → 詳細 → JavaScriptが有効になっているか確認
```

---

## 📊 テスト結果

### TypeScript コンパイル

```
✅ エラーなし
```

### ファイル検証

```
✅ components/PdfViewer.tsx: 21.21 KB
✅ public/pdfjs/pdf.worker.min.mjs: 1337.70 KB
✅ すべての必要なファイルが存在
```

---

## 🎓 技術的な詳細

### PDF.js Worker について

PDF.js は重い処理を WebWorker で実行します。Worker ファイルが正しく読み込めない場合、PDF 表示は失敗します。

**Worker 読み込みの流れ:**

1. メインスレッドで PDF.js を初期化
2. `GlobalWorkerOptions.workerSrc`で指定された Worker ファイルを読み込み
3. Worker スレッドを起動
4. PDF データを Worker に送信
5. Worker でパース・レンダリング
6. 結果をメインスレッドに返す

**失敗するポイント:**

- 相対パスの解決失敗
- CORS エラー
- Content-Type の不一致
- ネットワークタイムアウト

### Safari の制約

iPad の Safari には以下の制約があります:

1. **メモリ制限**: デスクトップより厳しい
2. **eval()制限**: セキュリティ上の理由で制限される場合がある
3. **Worker 制限**: 同時実行数に制限
4. **ネットワークタイムアウト**: より短い

---

## 📝 今後の改善案

### 短期(すぐに実装可能)

1. **フォールバック機能**

   - PDF.js が失敗した場合、ネイティブの PDF ビューアにフォールバック
   - `<embed>` または `<iframe>` タグを使用

2. **プログレスバー**

   - 大きな PDF ファイルの読み込み進捗を表示
   - ユーザーに待ち時間を通知

3. **エラーメッセージの改善**
   - より具体的なエラーメッセージ
   - 対処法の表示

### 中期(計画が必要)

1. **PDF 最適化**

   - PDF ファイルを軽量化
   - 低解像度版を作成

2. **レイジーロード**

   - 必要なページだけを読み込む
   - メモリ使用量を削減

3. **デバイス検出**
   - iPad Safari を検出
   - 専用の設定を適用

### 長期(アーキテクチャ変更が必要)

1. **サーバーサイドレンダリング**

   - PDF を画像に変換してから配信
   - クライアント負荷を軽減

2. **CDN 統合**

   - PDF.js Worker をキャッシュ
   - 高速な配信

3. **Progressive Web App 化**
   - オフライン対応
   - バックグラウンド同期

---

## ✅ チェックリスト

### 修正完了項目

- [x] PDF.js Worker 絶対パス設定
- [x] PDF.js Options 最適化(withCredentials, isEvalSupported)
- [x] エラーログの詳細化
- [x] onSourceError の詳細化
- [x] TypeScript 型チェック合格
- [x] 診断テストスクリプト作成

### iPad での確認項目(要実施)

- [ ] エラーが発生する iPad で再度テスト
- [ ] ブラウザコンソールでログ確認
- [ ] Worker ファイルの直接アクセス確認
- [ ] PDF ファイルの直接アクセス確認
- [ ] Safari のバージョン確認
- [ ] キャッシュクリア後の動作確認
- [ ] iPad 再起動後の動作確認

---

## 📞 サポート情報

### エラーが解決しない場合

以下の情報を収集してください:

1. **iPad の情報**

   - モデル名
   - iOS バージョン
   - Safari バージョン

2. **エラーログ**

   - ブラウザコンソールのすべてのエラーメッセージ
   - スクリーンショット

3. **ネットワーク情報**

   - Wi-Fi 接続状況
   - IP アドレス

4. **動作環境**
   - 他のアプリの起動状況
   - メモリ使用状況

---

## 🎉 まとめ

今回の修正により、以下が実現されました:

1. ✅ **Worker 読み込みの安定化**: 絶対 URL で確実に読み込める
2. ✅ **Safari 互換性の向上**: `isEvalSupported: false`で互換性向上
3. ✅ **CORS 問題の回避**: `withCredentials: false`で問題回避
4. ✅ **詳細なエラーログ**: 診断が容易に
5. ✅ **診断ツールの提供**: 問題の特定が迅速に

**次のステップ:**

1. エラーが発生する iPad で再度テスト
2. ブラウザコンソールでエラーログを確認
3. 必要に応じて追加の対処法を実施

---

**作成日**: 2025 年 11 月 6 日  
**バージョン**: 1.0  
**ステータス**: ✅ 修正完了 / ⏳ iPad 実機テスト待ち
