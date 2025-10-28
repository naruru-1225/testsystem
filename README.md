# テスト管理システム

塾内で使用するテスト管理 Web アプリケーション

## 概要

このシステムは、塾内でのテストの作成、管理、検索を効率的に行うための Web アプリケーションです。
タブレット端末での操作を想定し、直感的な UI と軽量な動作を実現しています。

## 技術スタック

- **フロントエンド**: React 19, Next.js 15, TypeScript
- **スタイリング**: Tailwind CSS
- **データベース**: SQLite (better-sqlite3)
- **開発環境**: Node.js 18 以上

## 主な機能

### 現在実装済み(最小規模)

- ✅ テスト一覧表示
- ✅ フォルダによるフィルタリング
- ✅ キーワード検索(テスト名、科目、学年)
- ✅ タグ表示
- ✅ レスポンシブデザイン(PC/タブレット対応)

### 今後実装予定

- テスト新規登録
- テスト編集
- テスト削除
- フォルダ管理
- テスト印刷機能
- テストプレビュー/詳細表示

## ディレクトリ構造

```
test_app/1/
├── app/                    # Next.js App Router
│   ├── api/               # APIルート
│   │   ├── folders/       # フォルダAPI
│   │   ├── tags/          # タグAPI
│   │   └── tests/         # テストAPI
│   ├── globals.css        # グローバルスタイル
│   ├── layout.tsx         # ルートレイアウト
│   └── page.tsx           # トップページ
├── components/            # Reactコンポーネント
│   ├── Sidebar.tsx        # サイドバー
│   └── TestList.tsx       # テスト一覧
├── lib/                   # ユーティリティ
│   └── database.ts        # データベース設定
├── types/                 # TypeScript型定義
│   └── database.ts        # DB型定義
├── data/                  # データファイル(自動生成)
│   └── tests.db           # SQLiteデータベース
├── package.json           # 依存関係
├── tsconfig.json          # TypeScript設定
├── tailwind.config.ts     # Tailwind CSS設定
└── next.config.ts         # Next.js設定
```

## データベース構造

### テーブル一覧

1. **folders** - フォルダ情報

   - id: フォルダ ID
   - name: フォルダ名
   - created_at: 作成日時

2. **tests** - テスト情報

   - id: テスト ID
   - name: テスト名
   - subject: 科目
   - grade: 学年
   - folder_id: フォルダ ID
   - created_at: 作成日時
   - updated_at: 更新日時

3. **tags** - タグ情報

   - id: タグ ID
   - name: タグ名
   - color: タグの色

4. **test_tags** - テストとタグの関連
   - id: ID
   - test_id: テスト ID
   - tag_id: タグ ID

## API 仕様

### テスト関連

- `GET /api/tests` - テスト一覧取得
  - クエリ: `folderId`, `search`
- `POST /api/tests` - テスト新規作成

### フォルダ関連

- `GET /api/folders` - フォルダ一覧取得
- `POST /api/folders` - フォルダ新規作成

### タグ関連

- `GET /api/tags` - タグ一覧取得

## 開発情報

### コーディング規約

- コンポーネントは関数コンポーネントで実装
- 'use client'ディレクティブで明示的にクライアントコンポーネント化
- コメントは日本語で記載
- 型定義は TypeScript で厳密に管理

### パフォーマンス最適化

- サーバーコンポーネントとクライアントコンポーネントの適切な分離
- 検索のデバウンス処理(300ms)
- SQLite のインデックス活用

### レスポンシブ対応

- Tailwind CSS のブレークポイント活用
- タブレット: 768px 以上でサイドバー表示
- スマートフォン: フルスクリーン表示

## ライセンス

このプロジェクトは塾内での使用を目的としています。

## サポート

問題が発生した場合は、`docs/troubleshooting.md`を参照してください。
