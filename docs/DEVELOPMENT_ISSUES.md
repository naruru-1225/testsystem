# テスト管理システム 開発トラブルシューティングガイド

**対象読者**: システム開発者、メンテナンス担当者  
**最終更新日**: 2025 年 10 月 29 日

---

## 📚 目次

1. [開発環境のセットアップで発生する問題](#開発環境のセットアップで発生する問題)
2. [データベース関連の問題](#データベース関連の問題)
3. [API エンドポイントの問題](#apiエンドポイントの問題)
4. [フロントエンド(React/Next.js)の問題](#フロントエンドreactnextjsの問題)
5. [ファイルアップロードの問題](#ファイルアップロードの問題)
6. [パフォーマンスの問題](#パフォーマンスの問題)
7. [デプロイ時の問題](#デプロイ時の問題)
8. [データ整合性の問題](#データ整合性の問題)
9. [セキュリティ上の考慮事項](#セキュリティ上の考慮事項)
10. [既知の制限事項と回避策](#既知の制限事項と回避策)

---

## 開発環境のセットアップで発生する問題

### 問題 1: npm install が失敗する

**症状**:

```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**原因**:

- パッケージの依存関係の競合
- Node.js のバージョンが古い
- npm のキャッシュが破損

**解決方法**:

```bash
# 方法1: キャッシュをクリアして再インストール
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# 方法2: レガシーピア依存関係を許可
npm install --legacy-peer-deps

# 方法3: Node.jsのバージョンを確認・更新
node --version  # v20.x以上推奨
```

**予防策**:

- `package.json`のバージョン範囲を適切に設定
- `.nvmrc`ファイルで Node.js バージョンを固定

---

### 問題 2: TypeScript コンパイルエラー

**症状**:

```
Type 'Promise<Params>' is not assignable to type 'Params'
```

**原因**:

- Next.js 15 では params が非同期(Promise)になった
- 型定義が古い

**解決方法**:

```typescript
// ❌ 古い書き方
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
}

// ✅ Next.js 15対応
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
}
```

**参考ファイル**:

- `app/api/tests/[id]/route.ts`
- `app/api/tests/[id]/attachments/route.ts`

---

### 問題 3: SQLite データベースの初期化エラー

**症状**:

```
Error: SQLITE_CANTOPEN: unable to open database file
```

**原因**:

- `data`ディレクトリが存在しない
- ファイルアクセス権限の問題

**解決方法**:

```bash
# データディレクトリを作成
mkdir -p data

# 権限を確認
ls -la data/

# 必要に応じて権限を付与
chmod 755 data
```

**lib/database.ts の確認**:

```typescript
// dataディレクトリが存在しない場合は作成
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
```

---

## データベース関連の問題

### 問題 4: NOT NULL constraint failed: tests.folder_id

**症状**:

```
Error: SQLITE_CONSTRAINT: NOT NULL constraint failed: tests.folder_id
```

**原因**:

- テスト更新時に`folder_id`が空配列になる
- `未分類`フォルダが存在しない
- フォルダ選択をすべて解除した場合の処理不備

**解決方法**:

**現在の実装(三重セーフティネット)**:

```typescript
// Layer 1: フォルダ選択後のチェック
let folderIds = formData.folderIds.filter(
  (id) => id !== uncategorizedFolder.id
);
if (folderIds.length === 0) {
  folderIds = [uncategorizedFolder.id];
}

// Layer 2: データベース更新前のチェック
if (!folderIds || folderIds.length === 0 || !folderIds[0]) {
  const uncategorized = db
    .prepare("SELECT id FROM folders WHERE name = '未分類'")
    .get() as { id: number } | undefined;

  if (!uncategorized) {
    db.prepare("INSERT INTO folders (name) VALUES (?)").run("未分類");
    const newUncategorized = db
      .prepare("SELECT id FROM folders WHERE name = '未分類'")
      .get() as { id: number };
    folderIds = [newUncategorized.id];
  } else {
    folderIds = [uncategorized.id];
  }
}

// Layer 3: folder_idの設定
const folder_id = folderIds[0];
```

**参考ファイル**:

- `app/api/tests/route.ts` (POST)
- `app/api/tests/[id]/route.ts` (PUT)

**予防策**:

- データベース初期化時に`未分類`フォルダを必ず作成
- `lib/database.ts`の初期化処理を確認

---

### 問題 5: SQLite WAL モードでのバックアップ不完全

**症状**:

- バックアップファイルが最新データを含まない
- 復元時にデータが欠損している

**原因**:

- SQLite が WAL(Write-Ahead Logging)モードで動作
- WAL ファイル(`.db-wal`)の内容がメインファイルに反映されていない

**解決方法**:

**❌ 不適切な方法**:

```typescript
// 単純にファイルをコピーするだけ
const dbBuffer = fs.readFileSync(dbPath);
```

**✅ 適切な方法**:

```typescript
import Database from "better-sqlite3";

// VACUUM INTOでWALの内容を含めた完全バックアップ
const db = new Database(dbPath, { readonly: true });
try {
  db.exec(`VACUUM INTO '${backupPath}'`);
} finally {
  db.close();
}
```

**参考ファイル**:

- `app/api/backup/create/route.ts`

**検証方法**:

```bash
# バックアップファイルのサイズを確認
ls -lh backup-*.db

# SQLiteで開いて内容を確認
sqlite3 backup-YYYY-MM-DD.db "SELECT COUNT(*) FROM tests;"
```

---

(続く... 文字数制限のため、以降の内容は別ファイルとして作成します)
