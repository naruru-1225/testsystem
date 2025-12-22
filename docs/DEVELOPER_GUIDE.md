# 開発者向け 完全トラブルシューティングガイド

このドキュメントは、テスト管理システムの開発・保守を担当する技術者向けに、発生が予想される障害とその解決方法を詳細に記載したものです。

**対象**: システム開発者、保守担当者、技術サポート  
**最終更新**: 2025 年 10 月 29 日

---

## 📋 目次

### 第 1 部: 開発環境の問題

1. [環境構築時のエラー](#1-環境構築時のエラー)
2. [依存パッケージの問題](#2-依存パッケージの問題)
3. [TypeScript/コンパイルエラー](#3-typescriptコンパイルエラー)

### 第 2 部: データベースの問題

4. [SQLite データベースエラー](#4-sqliteデータベースエラー)
5. [データ整合性の問題](#5-データ整合性の問題)
6. [バックアップ・復元の問題](#6-バックアップ復元の問題)

### 第 3 部: API/バックエンドの問題

7. [API エンドポイントのエラー](#7-apiエンドポイントのエラー)
8. [ファイルアップロードの問題](#8-ファイルアップロードの問題)
9. [パフォーマンスの劣化](#9-パフォーマンスの劣化)

### 第 4 部: フロントエンドの問題

10. [React/Next.js のエラー](#10-reactnextjsのエラー)
11. [UI コンポーネントの不具合](#11-uiコンポーネントの不具合)
12. [ブラウザ互換性の問題](#12-ブラウザ互換性の問題)

### 第 5 部: デプロイ・本番環境

13. [デプロイ時のエラー](#13-デプロイ時のエラー)
14. [本番環境特有の問題](#14-本番環境特有の問題)
15. [スケーラビリティの課題](#15-スケーラビリティの課題)

### 第 6 部: セキュリティ

16. [セキュリティ脆弱性](#16-セキュリティ脆弱性)
17. [データ保護の問題](#17-データ保護の問題)

### 第 7 部: 保守・運用

18. [ログとモニタリング](#18-ログとモニタリング)
19. [データマイグレーション](#19-データマイグレーション)
20. [バージョンアップ戦略](#20-バージョンアップ戦略)

---

## 第 1 部: 開発環境の問題

### 1. 環境構築時のエラー

#### 1-1. Node.js バージョン不整合

**症状**:

```
Error: The engine "node" is incompatible with this module
Expected version ">=20.0.0". Got "18.17.0"
```

**原因**:

- プロジェクトが要求する Node.js バージョンと、インストールされているバージョンが異なる
- Next.js 15 は Node.js 20 以上が必要

**解決方法**:

```bash
# 現在のバージョン確認
node --version

# nvmを使用してバージョンを切り替え
nvm install 20
nvm use 20

# または、Node.jsを直接インストール
# https://nodejs.org/ から LTS版をダウンロード
```

**予防策**:

- `.nvmrc`ファイルを作成してバージョンを固定

```
20.10.0
```

---

#### 1-2. npm install の失敗(ネットワークエラー)

**症状**:

```
npm ERR! code ETIMEDOUT
npm ERR! errno ETIMEDOUT
npm ERR! network request to https://registry.npmjs.org/... failed
```

**原因**:

- ネットワーク接続の問題
- npm レジストリへのアクセス制限
- プロキシ設定の問題

**解決方法**:

```bash
# npm設定を確認
npm config list

# タイムアウト時間を延長
npm config set timeout 60000

# プロキシを使用している場合
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# または、プロキシを無効化
npm config delete proxy
npm config delete https-proxy

# レジストリを変更(中国の場合など)
npm config set registry https://registry.npmmirror.com
```

---

### 2. 依存パッケージの問題

#### 2-1. パッケージの依存関係エラー

**症状**:

```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE could not resolve
npm ERR! peer react@"^18.0.0" from next@15.5.6
```

**原因**:

- パッケージ間の依存関係の競合
- React のバージョンの不整合

**解決方法**:

```bash
# 方法1: --legacy-peer-deps で強制インストール
npm install --legacy-peer-deps

# 方法2: --force で強制インストール(非推奨)
npm install --force

# 方法3: package-lock.jsonを削除して再インストール
rm package-lock.json
rm -rf node_modules
npm install

# 方法4: 特定のパッケージをアップデート
npm update react react-dom
```

**推奨される対応**:

```json
// package.json に overrides を追加(npm 8.3+)
{
  "overrides": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
```

---

#### 2-2. better-sqlite3 のビルドエラー

**症状**:

```
gyp ERR! build error
gyp ERR! stack Error: `C:\Program Files\MSBuild\...` failed with exit code: 1
```

**原因**:

- C++コンパイラがインストールされていない
- Python3 がインストールされていない
- Windows Build Tools がない

**解決方法(Windows)**:

```powershell
# Visual Studio Build Toolsをインストール
# https://visualstudio.microsoft.com/ja/downloads/

# または、windows-build-toolsを使用
npm install --global --production windows-build-tools

# Python3もインストール
# https://www.python.org/downloads/

# インストール後、npm rebuild
npm rebuild better-sqlite3
```

**解決方法(Mac)**:

```bash
# Xcode Command Line Toolsをインストール
xcode-select --install

# node-gypを再インストール
npm install -g node-gyp

# 再ビルド
npm rebuild better-sqlite3
```

---

### 3. TypeScript/コンパイルエラー

#### 3-1. Next.js 15 の Params 型エラー

**症状**:

```typescript
Type 'Promise<{ id: string }>' is not assignable to type '{ id: string }'
```

**原因**:

- Next.js 15 で動的ルートの params が非同期になった
- 既存のコードが Next.js 14 以前の記法

**解決方法**:

```typescript
// ❌ 古い記法(Next.js 14)
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const testId = params.id; // エラー
}

// ✅ 新しい記法(Next.js 15)
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params; // OK
}
```

**影響を受けるファイル**:

- `app/api/tests/[id]/route.ts`
- `app/api/tests/[id]/attachments/route.ts`
- `app/api/folders/[id]/route.ts`
- `app/api/tags/[id]/route.ts`
- `app/api/grades/[id]/route.ts`
- `app/api/subjects/[id]/route.ts`

---

#### 3-2. 型定義の不整合

**症状**:

```typescript
Property 'folders' does not exist on type 'Test'
```

**原因**:

- 型定義ファイル(`types/database.ts`)の更新漏れ
- インターフェース拡張の不備

**解決方法**:

```typescript
// types/database.ts を確認

// Testインターフェース
export interface Test {
  id: number;
  name: string;
  subject: string;
  grade: string;
  description?: string;
  pdf_path: string;
  folder_id: number;
  created_at: string;
  updated_at: string;
}

// TestWithTags インターフェース(拡張型)
export interface TestWithTags extends Test {
  tags: Tag[];
  folders: Folder[]; // この定義が必要
}
```

**検証方法**:

```bash
# TypeScriptのコンパイルチェック
npx tsc --noEmit

# または、ビルドしてエラーを確認
npm run build
```

---

## 第 2 部: データベースの問題

### 4. SQLite データベースエラー

#### 4-1. NOT NULL constraint failed: tests.folder_id

**最も頻出するエラー**

**症状**:

```
SqliteError: NOT NULL constraint failed: tests.folder_id
```

**原因**:

1. テスト作成時にフォルダを選択せず、`folder_id`が null になる
2. フォルダ削除後、関連するテストの`folder_id`が無効になる
3. `未分類`フォルダが存在しない

**詳細な発生シナリオ**:

```typescript
// シナリオ1: フォルダ未選択での作成
const formData = {
  name: "テスト",
  subject: "数学",
  grade: "中1",
  folderIds: [], // 空配列 → folder_idがnull
};

// シナリオ2: 未分類のみ選択 → 除外処理でfolderIds が空に
let folderIds = formData.folderIds.filter(
  (id) => id !== uncategorizedFolder.id
);
// folderIds = [] → folder_idがnull
```

**完全な解決方法(実装済み)**:

```typescript
// app/api/tests/route.ts (POST)
// 三重セーフティネット

// Layer 1: フォルダ選択の前処理
let folderIds = formData.folderIds || [];
const uncategorizedFolder = db
  .prepare("SELECT id FROM folders WHERE name = '未分類'")
  .get() as { id: number } | undefined;

// 未分類を除外
folderIds = folderIds.filter((id) => id !== uncategorizedFolder?.id);

// 空の場合は未分類を追加
if (folderIds.length === 0 && uncategorizedFolder) {
  folderIds = [uncategorizedFolder.id];
}

// Layer 2: データベース更新直前のチェック
if (!folderIds || folderIds.length === 0 || !folderIds[0]) {
  // 未分類フォルダの取得または作成
  let uncategorized = db
    .prepare("SELECT id FROM folders WHERE name = '未分類'")
    .get() as { id: number } | undefined;

  if (!uncategorized) {
    // 未分類フォルダがなければ作成
    console.log("Creating uncategorized folder...");
    db.prepare("INSERT INTO folders (name) VALUES (?)").run("未分類");
    uncategorized = db
      .prepare("SELECT id FROM folders WHERE name = '未分類'")
      .get() as { id: number };
  }

  folderIds = [uncategorized.id];
}

// Layer 3: 最終的なfolder_idの設定
const folder_id = folderIds[0]; // 必ず値が存在する保証

// データベースINSERT
db.prepare(
  `
  INSERT INTO tests (name, subject, grade, folder_id, pdf_path, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`
).run(name, subject, grade, folder_id, pdfPath);
```

**検証方法**:

```bash
# データベース整合性チェック
node check-db-integrity.mjs

# folder_idがNULLのテストを検出
sqlite3 data/tests.db "SELECT COUNT(*) FROM tests WHERE folder_id IS NULL;"
# 結果が0であるべき

# 未分類フォルダの存在確認
sqlite3 data/tests.db "SELECT * FROM folders WHERE name = '未分類';"
```

---

#### 4-2. database is locked エラー

**症状**:

```
SqliteError: database is locked
```

**原因**:

- 複数のプロセスが同時にデータベースにアクセス
- トランザクションがコミットされていない
- 接続が適切にクローズされていない

**解決方法**:

```typescript
// ❌ 問題のあるコード
const db = new Database("data/tests.db");
// 処理...
// closeを忘れる

// ✅ 推奨される方法
function withDatabase<T>(fn: (db: Database.Database) => T): T {
  const db = new Database("data/tests.db");
  try {
    return fn(db);
  } finally {
    db.close(); // 必ずクローズ
  }
}

// 使用例
const tests = withDatabase((db) => {
  return db.prepare("SELECT * FROM tests").all();
});
```

**WAL モードの設定(推奨)**:

```typescript
// lib/database.ts
const db = new Database(dbPath);
db.pragma("journal_mode = WAL"); // Write-Ahead Logを有効化
// WALモードでは読み取りと書き込みがブロックしない
```

**緊急対応**:

```bash
# データベースファイルのロックを確認
fuser data/tests.db  # Linux/Mac

# プロセスを終了
Stop-Process -Name node -Force  # Windows

# WALファイルを削除(最終手段)
rm data/tests.db-shm
rm data/tests.db-wal
```

---

### 5. データ整合性の問題

#### 5-1. 孤立データ(Orphaned Records)

**症状**:

- 削除されたフォルダの ID を参照しているテストが残る
- test_folders テーブルに無効な関連が残る

**検出クエリ**:

```sql
-- 存在しないfolder_idを持つテスト
SELECT t.id, t.name, t.folder_id
FROM tests t
WHERE NOT EXISTS (
  SELECT 1 FROM folders f WHERE f.id = t.folder_id
);

-- test_foldersに関連がないテスト
SELECT t.id, t.name
FROM tests t
WHERE NOT EXISTS (
  SELECT 1 FROM test_folders tf WHERE tf.test_id = t.id
);

-- 存在しないtest_idまたはfolder_idを参照するtest_folders
SELECT tf.*
FROM test_folders tf
WHERE NOT EXISTS (SELECT 1 FROM tests t WHERE t.id = tf.test_id)
   OR NOT EXISTS (SELECT 1 FROM folders f WHERE f.id = tf.folder_id);
```

**自動修復スクリプト**:

```javascript
// fix-orphaned-data.mjs
import Database from "better-sqlite3";
import path from "path";

const db = new Database("data/tests.db");

console.log("孤立データの修復を開始...");

// 1. test_foldersの孤立レコードを削除
const orphanedTestFolders = db
  .prepare(
    `
  DELETE FROM test_folders
  WHERE test_id NOT IN (SELECT id FROM tests)
     OR folder_id NOT IN (SELECT id FROM folders)
`
  )
  .run();
console.log(`孤立したtest_folders: ${orphanedTestFolders.changes}件削除`);

// 2. test_foldersに関連がないテストに未分類を追加
const uncategorized = db
  .prepare("SELECT id FROM folders WHERE name = '未分類'")
  .get();
if (uncategorized) {
  const orphanedTests = db
    .prepare(
      `
    SELECT t.id FROM tests t
    WHERE NOT EXISTS (SELECT 1 FROM test_folders tf WHERE tf.test_id = t.id)
  `
    )
    .all();

  const insertTf = db.prepare(
    "INSERT INTO test_folders (test_id, folder_id) VALUES (?, ?)"
  );
  orphanedTests.forEach((test) => {
    insertTf.run(test.id, uncategorized.id);
  });
  console.log(`未分類に追加: ${orphanedTests.length}件`);
}

// 3. 存在しないfolder_idを持つテストを未分類に変更
if (uncategorized) {
  const invalidFolderTests = db
    .prepare(
      `
    UPDATE tests SET folder_id = ?
    WHERE folder_id NOT IN (SELECT id FROM folders)
  `
    )
    .run(uncategorized.id);
  console.log(`folder_id修正: ${invalidFolderTests.changes}件`);
}

db.close();
console.log("修復完了");
```

実行:

```bash
node fix-orphaned-data.mjs
```

---

#### 5-2. 重複データの発生

**症状**:

- 同じテストに同じタグが複数回関連付けられている
- 同じ名前のフォルダが複数存在する

**検出クエリ**:

```sql
-- 重複タグ関連
SELECT test_id, tag_id, COUNT(*) as count
FROM test_tags
GROUP BY test_id, tag_id
HAVING COUNT(*) > 1;

-- 重複フォルダ名
SELECT name, COUNT(*) as count
FROM folders
GROUP BY name
HAVING COUNT(*) > 1;
```

**予防策(UNIQUE 制約の追加)**:

```sql
-- lib/database.ts の初期化時に追加

-- test_tagsにUNIQUE制約
CREATE TABLE IF NOT EXISTS test_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  UNIQUE(test_id, tag_id),  -- この行を追加
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- foldersにUNIQUE制約
CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,  -- UNIQUEを追加
  parent_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
);
```

**既存データのクリーンアップ**:

```sql
-- 重複タグ関連を削除(小さいIDのみ残す)
DELETE FROM test_tags
WHERE id NOT IN (
  SELECT MIN(id) FROM test_tags GROUP BY test_id, tag_id
);

-- 重複フォルダを削除(小さいIDのみ残す)
-- ※注意: フォルダ削除前にテストの関連を修正する必要あり
```

---

### 6. バックアップ・復元の問題

#### 6-1. バックアップファイルが不完全

**症状**:

- バックアップファイルのサイズが元のデータベースより小さい
- 復元時に最新のデータがない

**原因**:

- SQLite の WAL(Write-Ahead Logging)モードで、WAL ファイルの内容がバックアップに含まれていない

**問題のあるコード**:

```typescript
// ❌ 不完全なバックアップ
const dbBuffer = fs.readFileSync("data/tests.db");
fs.writeFileSync("backup.db", dbBuffer);
// WALファイル(.db-wal)の内容が含まれない
```

**正しいバックアップ方法(実装済み)**:

```typescript
// app/api/backup/create/route.ts
import Database from "better-sqlite3";

export async function GET() {
  const dbPath = path.join(process.cwd(), "data", "tests.db");
  const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
  const filename = `backup-${timestamp}.db`;
  const tempBackupPath = path.join(process.cwd(), "data", filename);

  // データベースを読み取り専用で開く
  const db = new Database(dbPath, { readonly: true });

  try {
    // VACUUM INTOで完全なバックアップを作成
    // WALファイルの内容も含まれる
    db.exec(`VACUUM INTO '${tempBackupPath.replace(/\\/g, "/")}'`);
  } finally {
    db.close();
  }

  // バックアップファイルを読み込んでレスポンス
  const backupBuffer = fs.readFileSync(tempBackupPath);
  fs.unlinkSync(tempBackupPath); // 一時ファイル削除

  return new NextResponse(backupBuffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": backupBuffer.length.toString(),
    },
  });
}
```

**検証方法**:

```bash
# バックアップ前後のレコード数を比較
sqlite3 data/tests.db "SELECT COUNT(*) FROM tests;"
# 例: 42

# バックアップを作成(ブラウザからダウンロード)

# バックアップファイルの内容を確認
sqlite3 backup-2025-10-29T14-30-00.db "SELECT COUNT(*) FROM tests;"
# 例: 42 (同じ数であるべき)

# すべてのテーブルのレコード数を比較
for table in tests folders tags test_folders test_tags; do
  echo "$table: $(sqlite3 data/tests.db "SELECT COUNT(*) FROM $table;")"
  echo "$table (backup): $(sqlite3 backup-*.db "SELECT COUNT(*) FROM $table;")"
done
```

---

## 第 3 部: API/バックエンドの問題

### 7. API エンドポイントのエラー

#### 7-1. タグフィルタが動作しない

**症状**:

- `/api/tests?tagId=1`にアクセスしても全テストが返される
- タグ ID でフィルタされない

**原因**:

- API ルートハンドラーで`tagId`パラメータが処理されていない
- SQL クエリに WHERE 条件が追加されていない

**修正前のコード(問題)**:

```typescript
// app/api/tests/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId");
  const grade = searchParams.get("grade");
  const subject = searchParams.get("subject");
  // tagIdが取得されていない

  let query = "SELECT * FROM tests WHERE 1=1";
  const params: any[] = [];

  if (grade) {
    query += " AND grade = ?";
    params.push(grade);
  }
  // tagIdのフィルタ処理がない

  const tests = db.prepare(query).all(...params);
  return NextResponse.json(tests);
}
```

**修正後のコード(実装済み)**:

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId");
  const grade = searchParams.get("grade");
  const subject = searchParams.get("subject");
  const tagId = searchParams.get("tagId"); // 追加
  const search = searchParams.get("search");

  let query = `
    SELECT 
      t.*,
      f.name as folder_name
    FROM tests t
    LEFT JOIN folders f ON t.folder_id = f.id
    WHERE 1=1
  `;
  const params: any[] = [];

  // タグでフィルタ
  if (tagId) {
    query += ` AND EXISTS (
      SELECT 1 FROM test_tags tt 
      WHERE tt.test_id = t.id AND tt.tag_id = ?
    )`;
    params.push(tagId);
  }

  // 他のフィルタ...

  const tests = db.prepare(query).all(...params);
  return NextResponse.json(tests);
}
```

**テスト方法**:

```bash
# タグ一覧を取得してtagIdを確認
curl http://localhost:3000/api/tags
# [{"id":1,"name":"重要",...},{"id":2,"name":"復習",...}]

# タグIDでフィルタ
curl http://localhost:3000/api/tests?tagId=1
# tagId=1が付いているテストのみ返されるべき

# 他のフィルタとの併用
curl "http://localhost:3000/api/tests?tagId=1&grade=%E4%B8%AD1"
# 中1 かつ タグID=1
```

---

#### 7-2. フォルダの子孫が取得できない

**症状**:

- 親フォルダでフィルタしても、子フォルダのテストが表示されない

**原因**:

- フォルダの階層構造を再帰的に取得していない

**実装済みの解決策**:

```typescript
// app/api/tests/route.ts

/**
 * 指定されたフォルダの子孫フォルダIDを全て取得する(再帰的)
 */
function getDescendantFolderIds(folderId: number): number[] {
  const descendants: number[] = [];
  const children = db
    .prepare("SELECT id FROM folders WHERE parent_id = ?")
    .all(folderId) as { id: number }[];

  for (const child of children) {
    descendants.push(child.id);
    // 再帰的に孫フォルダも取得
    descendants.push(...getDescendantFolderIds(child.id));
  }

  return descendants;
}

export async function GET(request: Request) {
  // ...

  if (folderId) {
    // 選択されたフォルダとその子孫フォルダのIDを取得
    const descendantIds = getDescendantFolderIds(parseInt(folderId));
    descendantIds.push(parseInt(folderId)); // 自分自身も含める

    // test_foldersテーブルを使ってフィルタ
    if (descendantIds.length === 1) {
      query += ` AND EXISTS (
        SELECT 1 FROM test_folders tf 
        WHERE tf.test_id = t.id AND tf.folder_id = ?
      )`;
      params.push(folderId);
    } else {
      const placeholders = descendantIds.map(() => "?").join(",");
      query += ` AND EXISTS (
        SELECT 1 FROM test_folders tf 
        WHERE tf.test_id = t.id AND tf.folder_id IN (${placeholders})
      )`;
      params.push(...descendantIds);
    }
  }

  // ...
}
```

**テストケース**:

```sql
-- テストデータ準備
INSERT INTO folders (name, parent_id) VALUES ('親', NULL);
INSERT INTO folders (name, parent_id) VALUES ('子', 1);
INSERT INTO folders (name, parent_id) VALUES ('孫', 2);

INSERT INTO tests (name, folder_id, ...) VALUES ('テスト1', 1, ...);
INSERT INTO tests (name, folder_id, ...) VALUES ('テスト2', 2, ...);
INSERT INTO tests (name, folder_id, ...) VALUES ('テスト3', 3, ...);

-- フォルダ「親」(id=1)でフィルタ
-- 期待: テスト1, テスト2, テスト3 すべて取得されるべき
```

---

(文字数制限のため、ここまでとします。完全版は非常に長大になるため、必要な部分を段階的に追加することをお勧めします)

## 📝 まとめ

このドキュメントは実際の開発で遭遇した問題とその解決策をまとめたものです。

**重要なポイント**:

1. **データベース整合性**: folder_id の NOT NULL 制約が最も頻出する問題
2. **バックアップ**: VACUUM INTO を使用した完全バックアップが必須
3. **Next.js 15 対応**: params の非同期化に対応が必要
4. **型安全性**: TypeScript の型定義を最新に保つ

**推奨される開発フロー**:

```bash
# 1. 開発環境のセットアップ
npm install
node check-db-integrity.mjs  # データベース確認

# 2. 開発
npm run dev

# 3. テスト
npm run build  # TypeScriptエラーチェック
node test-api.mjs  # APIテスト

# 4. デプロイ前チェック
npm run build
node check-db-integrity.mjs
```

---

**このドキュメントは随時更新してください。新しい問題が発見されたら、必ず記録を残してください。**

© 2025 テスト管理システム開発チーム
