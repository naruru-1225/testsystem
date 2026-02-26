# 機能改善 実装進捗メモ

> このファイルは実装状況を追跡するためのメモです。機能番号は `improvement_suggestions.md` に対応しています。

## ✅ 実装済み

### PDFビューワー
- #1 ページジャンプ機能 ✅ (PdfViewer.tsx)
- #2 ページサムネイル一覧 ✅ (PdfViewer.tsx)
- #3 キーボードショートカット ✅ (PdfViewer.tsx - ←→ズームEsc)
- #4 ピンチズーム対応 ✅ (PdfViewer.tsx)
- #5 フィット表示モード ✅ (PdfViewer.tsx - 幅/全/自由)
- #6 PDFビューワーダークモード ✅ (PdfViewer.tsx)
- #7 回転機能 ✅ (PdfViewer.tsx)
- #8 連続スクロール表示 ✅ (PdfViewer.tsx)
- #9 PDF内テキスト検索UI ✅ (PdfViewer.tsx - showPdfSearch, handlePdfSearch)
- #10 ページ範囲指定印刷 ✅ (PdfViewer.tsx - printPageFrom/To)
- #11 両面印刷設定 ✅ (PdfViewer.tsx - printDuplex)
- #12 印刷設定パネル(ギアボタン) ✅ (PdfViewer.tsx - showPrintSettings)
- #13 複数部数の指定 ✅ (PdfViewer.tsx - printCopies)
- #15 A5/Letterサイズ選択 ✅ (PdfViewer.tsx - size select dropdown)
- #14 変換プログレス表示 ✅ (PdfViewer.tsx - loading propに変換中メッセージ追加)
- #16 カスタムサイズ入力 ✅ (PdfViewer.tsx - customWidthMm/customHeightMm)

### テスト登録・編集フォーム
- #17 フォームの自動保存 ✅ (TestCreateForm.tsx - localStorage draft)
- #18 前回入力値の引継ぎ ✅ (TestCreateForm.tsx - last-submitted key)
- #19 テンプレート機能 ✅ (TestCreateForm.tsx)
- #20 複数PDF一括作成 ✅ (TestCreateForm.tsx - showMultiBatchModal/handleMultiBatchCreate)
- #22 添付ファイルの並び替え ✅ (TestCreateForm.tsx, TestEditForm.tsx)
- #23 バリデーションメッセージの改善 ✅ (TestCreateForm.tsx - fieldErrors)
- #24 Word/Excelファイル添付対応 ✅ (api/upload/route.ts, TestCreateForm.tsx, TestEditForm.tsx - doc/docx/xls/xlsx)
- #25 ファイルサイズ上限の表示 ✅ (TestCreateForm.tsx - formatFileSize)
- #26 ファイルタイプアイコン ✅ (TestCreateForm.tsx - getFileIcon Word/Excel含む)
- #27 複数ファイル同時アップロード ✅ (TestCreateForm.tsx - multiple属性, handleAttachmentChange loop)
- #28 アップロード進捗表示 ✅ (TestCreateForm.tsx, TestEditForm.tsx - XHR progress)

### テスト一覧
- #29 並び替え機能（カラムソート） ✅ (TestList.tsx)
- #30 表示件数の切り替え ✅ (TestList.tsx - 10/25/50/100/全件)
- #31 ページネーション ✅ (TestList.tsx)
- #32 カード表示モード ✅ (TestList.tsx)
- #33 テスト件数の表示 ✅ (TestList.tsx - "○件")
- #34 列のカスタマイズ（表示列の選択） ✅ (TestList.tsx - visibleColumns, localStorage)
- #35 列幅のリサイズ ✅ (TestList.tsx - colWidths/handleColResizeStart, localStorage)
- #36 行の高さ調整 ✅ (TestList.tsx - compact/standard/wide)
- 標準表示に戻すボタン ✅ (TestList.tsx - sortOrder/viewMode/rowHeight/perPage/visibleColumns/colWidths全てリセット)
- #37 複数選択チェックボックス ✅ (TestList.tsx)
- #38 一括操作（削除/フォルダ移動/学年・科目変更/タグ付け） ✅ (TestList.tsx)
- #39 一括印刷 ✅ (TestList.tsx)
- #40 テストの複製機能 ✅ (TestList.tsx + api/tests/[id]/clone)
- #42 ドラッグ&ドロップでフォルダ移動 ✅ (TestList.tsx draggable rows, Sidebar handleDrop, PATCH /api/tests/[id])
- #43 検索ハイライト ✅ (TestList.tsx - highlightText)
- #44 詳細検索フィルタ ✅ (TestList.tsx - 日付/大問数)
- #45 検索履歴 ✅ (TestList.tsx - localStorage)
- #46 複数タグでのフィルタ（AND/OR） ✅ (TestList.tsx)
- #47 フィルタのプリセット保存 ✅ (TestList.tsx)
- #88 ローディングスケルトン ✅ (TestList.tsx)
- #89 エラー時のリトライボタン ✅ (TestList.tsx)
- #90 確認ダイアログのモーダル化 ✅ (TestList.tsx)
- #104 操作の取り消し（Undo削除） ✅ (TestList.tsx - 8秒Undo)
- #106 PDF一括ZIPダウンロード ✅ (TestList.tsx + api/export/zip)
- #109 QRコード生成 ✅ (TestList.tsx + api/tests/[id]/qr)
- #118 テスト間のリンク（関連テスト） ✅ (TestList.tsx + api/tests/[id]/related)
- #119 コメント機能 ✅ (TestList.tsx + api/tests/[id]/comments)
- #124 テストデータ変更履歴 ✅ (TestList.tsx + api/tests/[id]/history)

### サイドバー・フォルダ管理
- #48 フォルダ内テスト件数表示 ✅ (Sidebar.tsx - useFolders(true))
- #50 フォルダアイコン設定 ✅ (database.ts icon列追加, folderRepository.update, Sidebar.tsx, AdminModal.tsx)
- #51 フォルダの検索 ✅ (Sidebar.tsx - folderSearchQuery)
- #53 フォルダの並び替え（同階層内） ✅ (Sidebar.tsx - drag&drop reorder)

### タグ・ラベル管理
- #58 タグの一括付与 ✅ (TestList.tsx - bulkAction=tag)
- #61 タグの色カスタマイズ ✅ (AdminModal.tsx - colorPalette)

### ダッシュボード
- #62 期間フィルタ ✅ (dashboard/page.tsx)
- #63 登録推移グラフ ✅ (dashboard/page.tsx)
- #64 科目別カバー率 ✅ (dashboard/page.tsx)
- #65 ストレージ使用量 ✅ (dashboard/page.tsx)
- #66 ウィジェットカスタマイズ ✅ (dashboard/page.tsx)
- #67 CSVダウンロード ✅ (dashboard/page.tsx)

### 管理画面 (AdminModal)
- #68 学年・科目の並び替え ✅ (AdminModal.tsx - handleMoveGrade, handleMoveSubject)
- #69 学年・科目の使用件数表示 ✅ (AdminModal.tsx - withCounts=true API)
- #70 使用中マスターデータ削除防止（代替先選択UI） ✅ (AdminModal.tsx - replaceDialog)
- #72 自動バックアップ設定UI ✅ (AdminModal.tsx - backupFrequencyDays/backupMaxCount)
- #73 バックアップ履歴一覧 ✅ (AdminModal.tsx - fetchBackupList)
- #74 差分復元（選択して復元） ✅ (AdminModal.tsx - backupTests + selectedTests)

### メール自動取り込み
- #78 取り込み通知バッジ ✅ (Sidebar.tsx - inboxPendingCount)
- #79 エラーの再試行ボタン ✅ (EmailInbox.tsx)
- #80 コンテンツハッシュ重複チェック ✅ (emailPoller.ts, emailInboxRepository.ts)
- 受信トレイ一括テスト作成 ✅ (EmailInbox.tsx - showBatchModal, handleBatchCreate)
- デモシードデータ投入 ✅ (app/api/seed/demo/route.ts, AdminModal.tsx "デモデータ作成"ボタン)
- 受信トレイからファイル選択（テスト登録/編集フォーム） ✅ (TestCreateForm.tsx, TestEditForm.tsx, api/tests/[id]/attachments POST)

### UI/UX全般
- #82 ダークモード対応 ✅ (ThemeProvider.tsx)
- #83 フォントサイズ調整 ✅ (ThemeProvider.tsx - small/medium/large)
- #87 トースト通知 ✅ (ToastProvider.tsx)
- #91 ブラウザ戻るボタン対応 ✅ (TestList.tsx - pushState/popstate)
- #93 キーボードナビゲーション強化 ✅ (TestList.tsx - tabIndex/onKeyDown on rows, PdfViewer ←→ショートカット)
- #101 入力値サニタイズ ✅ (api/tests/route.ts - sanitizeText)
- #103 アクセスログ（端末情報） ✅ (auditService + device_hint)
- #112 ツールチップの充実 ✅ (PdfViewer.tsx, Sidebar.tsx - title属性追加)
- #123 メモのMarkdown書式対応 ✅ (TestList.tsx - renderMarkdown/stripMarkdown)

### セキュリティ
- #102 ファイルタイプ厳密チェック ✅ (api/upload - magic number check)
- #105 同時編集競合防止 ✅ (TestEditForm.tsx - lastKnownUpdatedAt, api/tests/[id] PUT 409)
- #111 空状態の改善 ✅ (TestList.tsx)

### パフォーマンス
- #96 画像の遅延読み込み ✅ (PdfViewer.tsx - loading="lazy" decoding="async")
- #97 APIレスポンスキャッシュ ✅ (grades/subjects/tags/folders GET - Cache-Control: max-age=30)
- #99 dynamic importによるコンポーネント遅延読み込み ✅ (TestList.tsx - PdfViewer, AdminModal)
- #100 サーバーサイドページネーション（APIに page/limit 追加） ✅ (api/tests/route.ts)

---

## 🚧 残り未実装・対象外

### パフォーマンス
- #95 仮想スクロール（ページネーションで代替）
- #98 PDFストリーミング

## 除外機能（対象外）
21, 41, 49, 52, 54, 55, 56, 57, 59, 60, 71, 75, 76, 77, 81, 84, 85, 86, 92, 94, 107, 108, 110, 113, 114, 115, 116, 117, 120, 121, 122
