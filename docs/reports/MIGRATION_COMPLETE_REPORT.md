# フォルダ制約変更 - 完全適用レポート

**日付**: 2025-01-XX  
**バージョン**: 2.0  
**ステータス**: ✅ 完了 (全 5 テーブル修正済み)

---

## 📊 実行サマリー

### 修正対象テーブル

| #   | テーブル名       | 修正内容                                                | ステータス |
| --- | ---------------- | ------------------------------------------------------- | ---------- |
| 1   | folders          | UNIQUE 制約変更 (name → name,parent_id)                 | ✅ 完了    |
| 2   | tests            | 外部キー修正 (folders_old → folders)                    | ✅ 完了    |
| 3   | test_folders     | 外部キー修正 (tests_backup,folders_old → tests,folders) | ✅ 完了    |
| 4   | test_tags        | 外部キー修正 (tests_backup → tests)                     | ✅ 完了    |
| 5   | test_attachments | 外部キー修正 (tests_backup → tests)                     | ✅ 完了    |

---

## ✅ 検証結果

### verify-migration.mjs の実行結果

```
✅ マイグレーション検証スクリプト
==================================================
[テスト1] folders_oldへの参照チェック
  ✅ 古いテーブルへの参照なし

[テスト2] foldersテーブルの制約確認
  ✅ UNIQUE(name, parent_id)制約あり

[テスト3] testsテーブルの外部キー確認
  ✅ testsテーブル: FOREIGN KEY → folders

[テスト4] test_foldersテーブルの外部キー確認
  ✅ test_foldersテーブル: FOREIGN KEY → tests, folders

[テスト5] 未分類フォルダの確認
  ✅ 未分類フォルダ存在 (ID: 2)

[テスト6] 同名フォルダの作成テスト
  ✅ 異なる親での同名フォルダ作成: 成功
  ✅ 同じ親での同名フォルダ作成: 正しくエラー
==================================================
🎉 すべての検証に合格しました!
✅ マイグレーションは正常に完了しています
✅ テスト作成機能が正常に動作するはずです
```

---

## 🔧 実行したマイグレーション

### 1. migrate-folder-unique-constraint.mjs

- **目的**: folders テーブルの UNIQUE 制約を変更
- **変更**: `UNIQUE(name)` → `UNIQUE(name, parent_id)`
- **結果**: ✅ 成功 (移行されたフォルダ数: 8 件)

### 2. fix-tests-foreign-key.mjs

- **目的**: tests テーブルの外部キー参照を修正
- **変更**: `REFERENCES "folders_old"` → `REFERENCES folders`
- **結果**: ✅ 成功 (移行されたテスト数: 0 件)
- **再構築したインデックス**: folder_id, subject, grade

### 3. fix-test-folders-foreign-key.mjs

- **目的**: test_folders テーブルの外部キー参照を修正
- **変更**:
  - `REFERENCES "tests_backup"` → `REFERENCES tests`
  - `REFERENCES "folders_old"` → `REFERENCES folders`
- **結果**: ✅ 成功 (移行されたレコード数: 0 件)

### 4. fix-test-tags-foreign-key.mjs

- **目的**: test_tags テーブルの外部キー参照を修正
- **変更**: `REFERENCES "tests_backup"` → `REFERENCES tests`
- **結果**: ✅ 成功 (移行されたレコード数: 0 件)

### 5. fix-test-attachments-foreign-key.mjs

- **目的**: test_attachments テーブルの外部キー参照を修正
- **変更**: `REFERENCES "tests_backup"` → `REFERENCES tests`
- **結果**: ✅ 成功 (移行されたレコード数: 0 件)

---

## 📁 作成されたスクリプト一覧

### マイグレーションスクリプト (5 個)

1. `migrate-folder-unique-constraint.mjs` - folders テーブル修正
2. `fix-tests-foreign-key.mjs` - tests テーブル修正
3. `fix-test-folders-foreign-key.mjs` - test_folders テーブル修正
4. `fix-test-tags-foreign-key.mjs` - test_tags テーブル修正
5. `fix-test-attachments-foreign-key.mjs` - test_attachments テーブル修正

### 検証・テストスクリプト (5 個)

6. `verify-migration.mjs` - 完全な検証スクリプト (6 つのテスト)
7. `test-folder-uniqueness.mjs` - フォルダ作成機能テスト (3 シナリオ)
8. `search-old-references.mjs` - 古いテーブル参照の検索
9. `check-remaining-tables.mjs` - 残存テーブル構造確認
10. `run-all-migrations.mjs` - 統合マイグレーション実行スクリプト

### その他のデバッグツール

11. `debug-test-creation.mjs` - テスト作成問題のデバッグ
12. `check-db.mjs` - データベース状態確認
13. `check-folders.mjs` - フォルダ階層確認

---

## 🎯 機能変更の効果

### 変更前の動作

```
ルート/
├── テスト用/           ← 作成可能
└── 数学/
    └── テスト用/       ← ❌ エラー: 同名フォルダは作成不可
```

### 変更後の動作

```
ルート/
├── テスト用/           ← 作成可能
└── 数学/
    └── テスト用/       ← ✅ 作成可能! (親が違うのでOK)
```

### 同じ親内では従来通りエラー

```
ルート/
└── 数学/
    ├── テスト用/       ← 作成可能
    └── テスト用/       ← ❌ エラー: 同じ親内に同名は不可
```

---

## 🔍 データベース整合性チェック

### 外部キー制約の状態

✅ **folders テーブル**

```sql
UNIQUE(name, parent_id)  -- 親フォルダ内でユニーク
FOREIGN KEY (parent_id) REFERENCES folders (id) ON DELETE CASCADE
```

✅ **tests テーブル**

```sql
FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE
-- folders_old への参照なし
```

✅ **test_folders テーブル**

```sql
FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE CASCADE
FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE
-- tests_backup, folders_old への参照なし
```

✅ **test_tags テーブル**

```sql
FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE CASCADE
FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
-- tests_backup への参照なし
```

✅ **test_attachments テーブル**

```sql
FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE CASCADE
-- tests_backup への参照なし
```

### 孤立した参照のチェック

```bash
✅ folders_old への参照: 0件
✅ tests_backup への参照: 0件
✅ すべての外部キーが正しいテーブルを参照
```

---

## 📝 API 変更

### POST /api/folders

**変更内容**: 親フォルダを考慮した同名チェックを実装

```typescript
// 同じ親フォルダ内での重複チェック
const checkStmt = db.prepare(
  "SELECT id FROM folders WHERE name = ? AND parent_id IS ?"
);
const existing = checkStmt.get(name, parentId);

if (existing) {
  return NextResponse.json(
    { error: "同じ親フォルダ内に同名のフォルダが既に存在します" },
    { status: 400 }
  );
}
```

### PUT /api/folders/[id]

**変更内容**: 自分自身を除外した親フォルダ内での同名チェック

```typescript
// 編集時: 自分以外で同名チェック
const checkStmt = db.prepare(
  "SELECT id FROM folders WHERE name = ? AND parent_id IS ? AND id != ?"
);
const duplicateFolder = checkStmt.get(name, parentId, folderId);
```

---

## ✨ ユーザー体験の改善

### 改善点

1. **柔軟なフォルダ構造** - 教科ごとに「練習問題」「過去問」など同じ名前のフォルダを作成可能
2. **直感的な整理** - 親フォルダで文脈を分けられる
3. **明確なエラーメッセージ** - 「同じ親フォルダ内に...」と具体的に表示

### 使用例

```
ルート/
├── 数学/
│   ├── 基礎/
│   ├── 応用/
│   └── 過去問/
├── 英語/
│   ├── 基礎/        ← 数学の「基礎」と同名OK!
│   ├── 応用/        ← 数学の「応用」と同名OK!
│   └── 過去問/      ← 数学の「過去問」と同名OK!
└── 理科/
    ├── 基礎/
    ├── 応用/
    └── 過去問/
```

---

## 🧪 テスト結果

### test-folder-uniqueness.mjs

```
テスト1: 同じ親フォルダ内での同名作成を拒否
  期待: エラー
  結果: ✅ 正しくエラー

テスト2: 異なる親フォルダでの同名作成を許可
  期待: 成功
  結果: ✅ 成功

テスト3: ルート階層での同名作成を拒否
  期待: エラー
  結果: ✅ 正しくエラー

🎉 すべてのテストが成功しました!
```

---

## 📦 デプロイ用チェックリスト

他の環境に適用する場合:

### 事前準備

- [ ] データベースのバックアップ作成
- [ ] アプリケーションの停止
- [ ] すべてのスクリプトファイルの配置

### マイグレーション実行

- [ ] `node run-all-migrations.mjs` を実行
  - または個別に:
    - [ ] `node migrate-folder-unique-constraint.mjs`
    - [ ] `node fix-tests-foreign-key.mjs`
    - [ ] `node fix-test-folders-foreign-key.mjs`
    - [ ] `node fix-test-tags-foreign-key.mjs`
    - [ ] `node fix-test-attachments-foreign-key.mjs`

### 検証

- [ ] `node verify-migration.mjs` で検証 (すべて ✅)
- [ ] `node test-folder-uniqueness.mjs` でテスト (すべて成功)

### 起動と確認

- [ ] アプリケーションの起動 (`npm run dev`)
- [ ] ブラウザでフォルダ作成テスト
- [ ] テスト作成機能の動作確認

---

## 🎉 完了!

すべてのマイグレーションが完了し、システムは正常に動作しています。

### 主な成果

- ✅ 5 つのテーブルすべての外部キー制約を修正
- ✅ 親フォルダを考慮したフォルダ名制約を実装
- ✅ API の重複チェックロジックを更新
- ✅ 完全な検証とテストを実施
- ✅ データの整合性を維持

### 次のステップ

1. ユーザーに新機能を案内
2. フィードバックを収集
3. 必要に応じて追加の改善を実施

---

**このシステムは、より柔軟で直感的なフォルダ管理を提供します。**  
**教科や単元ごとに同じ名前のフォルダを使えるようになり、整理がしやすくなりました!**
