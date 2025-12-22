# タグ削除機能の改善レポート

**日付**: 2025-11-14  
**ステータス**: ✅ 完了

---

## 📝 問題

管理者メニューからタグを削除しようとすると、以下のエラーメッセージが表示されていました:

```
このタグは1件のテストで使用されています。先にテストから削除してください。
```

### 問題の原因

`app/api/tags/[id]/route.ts` の DELETE エンドポイントで、タグが使用されているかどうかを手動でチェックし、使用されている場合は削除を拒否する実装になっていました。

```typescript
// 問題のあったコード
const testCount = db
  .prepare("SELECT COUNT(*) as count FROM test_tags WHERE tag_id = ?")
  .get(tagId) as { count: number };

if (testCount.count > 0) {
  return NextResponse.json(
    {
      error: `このタグは${testCount.count}件のテストで使用されています。先にテストから削除してください。`,
    },
    { status: 409 }
  );
}
```

---

## 🔧 解決方法

### データベーススキーマの確認

`test_tags` テーブルには、すでに `ON DELETE CASCADE` 制約が設定されていました:

```sql
CREATE TABLE test_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,  ← これ!
  UNIQUE(test_id, tag_id)
)
```

この制約により、タグを削除すると関連する `test_tags` レコードが**自動的に削除**されます。

### API の修正

不要な手動チェックを削除し、データベースのカスケード削除に任せるように修正しました:

```typescript
// 修正後のコード
const existingTag = db.prepare("SELECT id FROM tags WHERE id = ?").get(tagId);

if (!existingTag) {
  return NextResponse.json({ error: "タグが見つかりません" }, { status: 404 });
}

// タグを削除 (test_tagsの関連レコードはON DELETE CASCADEで自動削除される)
db.prepare("DELETE FROM tags WHERE id = ?").run(tagId);

return NextResponse.json({ success: true });
```

---

## ✅ 動作確認

### テストスクリプトの実行結果

`test-tag-cascade-delete.mjs` を実行:

```
✅ すべてのテストが成功しました!

動作確認:
  ✓ タグが削除された
  ✓ test_tags の関連レコードが自動削除された (ON DELETE CASCADE)
  ✓ テスト本体は削除されずに残っている
```

---

## 🎯 変更の効果

### 変更前

```
管理者メニュー → タグ削除
  ↓
❌ エラー: このタグは1件のテストで使用されています
  ↓
テスト編集画面でタグを一つずつ手動削除
  ↓
再度タグ削除を試行
  ↓
✓ 削除成功
```

### 変更後

```
管理者メニュー → タグ削除
  ↓
✓ 削除成功 (test_tagsの関連も自動削除)
```

---

## 📊 技術詳細

### カスケード削除の動作

1. **タグ削除実行**

   ```sql
   DELETE FROM tags WHERE id = ?
   ```

2. **自動的に実行される** (データベースが処理)

   ```sql
   DELETE FROM test_tags WHERE tag_id = ?
   ```

3. **結果**
   - `tags` テーブルからタグが削除される
   - `test_tags` テーブルから関連レコードが削除される
   - `tests` テーブルのテスト本体は影響を受けない

### フォルダとの整合性

この変更により、タグの削除動作がフォルダの削除動作と同じになりました:

| 操作         | 削除されるもの         | 削除されないもの |
| ------------ | ---------------------- | ---------------- |
| フォルダ削除 | フォルダ、test_folders | テスト本体       |
| タグ削除     | タグ、test_tags        | テスト本体       |

---

## 🔍 影響範囲

### 変更されたファイル

1. **app/api/tags/[id]/route.ts**
   - DELETE エンドポイントから手動チェックを削除
   - カスケード削除に依存するようコメントを追加

### 変更されなかったファイル

- **データベーススキーマ**: すでに `ON DELETE CASCADE` が設定済み
- **フロントエンド**: API のレスポンスは変わらないため修正不要

---

## 🧪 テストファイル

### test-tag-cascade-delete.mjs

タグのカスケード削除をテストするスクリプトを作成しました。

**テストシナリオ:**

1. テスト用タグを作成
2. テスト用テストを作成
3. テストにタグを紐付け
4. タグを削除
5. 削除後の状態を確認
   - タグが削除されたか
   - test_tags の関連レコードが削除されたか
   - テスト本体が残っているか

**実行方法:**

```powershell
node test-tag-cascade-delete.mjs
```

---

## 👥 ユーザー体験の改善

### 変更前の体験

1. 管理者メニューでタグを削除しようとする
2. エラーメッセージが表示される
3. どのテストで使われているか探す
4. 各テストを編集してタグを削除
5. 再度タグ削除を試行
6. やっと削除できる

**問題点:**

- 手間がかかる
- 使用されているテストを探すのが大変
- フォルダは削除できるのにタグは削除できないという非一貫性

### 変更後の体験

1. 管理者メニューでタグを削除
2. 即座に削除完了

**改善点:**

- ワンクリックで削除
- 関連レコードは自動的にクリーンアップ
- フォルダと同じ直感的な動作

---

## 🔒 データ整合性

### 安全性の確認

✅ **外部キー制約により保証される**

- `ON DELETE CASCADE` は ACID トランザクションの一部
- データベースが原子性を保証
- 部分的な削除は発生しない

✅ **孤立レコードの防止**

- タグが削除されると test_tags も自動削除
- 存在しないタグへの参照は残らない

✅ **テストの保護**

- テスト本体には影響なし
- タグとの関連のみが削除される

---

## 📚 関連ドキュメント

### 同様の実装

- **フォルダ削除**: `app/api/folders/[id]/route.ts`
  - test_folders の関連レコードが ON DELETE CASCADE で自動削除
  - テスト本体は削除されない

### データベーススキーマ

- **lib/schema.sql**: 全テーブルの外部キー制約定義
- すべての関連テーブルに ON DELETE CASCADE が設定済み

---

## 🎉 まとめ

### 完了した作業

✅ API から不要な手動チェックを削除  
✅ カスケード削除の動作を確認  
✅ テストスクリプトを作成して検証  
✅ フォルダとの動作を統一

### 期待される効果

- ユーザー体験の向上 (手間の削減)
- 操作の一貫性 (フォルダとタグが同じ動作)
- コードの簡素化 (不要なチェック削除)
- データ整合性の維持 (データベース制約に依存)

---

**この修正により、タグの削除がフォルダと同様に直感的に行えるようになりました!**
