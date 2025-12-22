# 本番環境マイグレーション - トラブルシューティングガイド

## ❌ 発生したエラー

```
❌ マイグレーションエラー: SqliteError: no such table: main.folders_old
```

## 🔍 原因

**ステップ 1 の `migrate-folder-unique-constraint.mjs` が実行されていない状態で、ステップ 2 を実行しようとしたため。**

マイグレーションは**必ず順番通り**に実行する必要があります。

---

## ✅ 解決方法

### 手順 1: 現在の状態を確認

本番環境で以下のファイルを実行して、現在どのステップまで完了しているか確認します:

```powershell
# check-migration-status.mjs を本番環境にコピー
# 開発環境から実行(パスは適宜変更):
Copy-Item "check-migration-status.mjs" "C:\Users\管理者ユーザー\Desktop\testproject\"

# 本番環境で実行:
cd C:\Users\管理者ユーザー\Desktop\testproject
node check-migration-status.mjs
```

このスクリプトが、次に実行すべきステップを教えてくれます。

### 手順 2: データベースをリセット(必要な場合)

もしステップ 2 を途中まで実行してしまった場合は、バックアップから復元します:

```powershell
# アプリケーションを停止
# (実行中のnpmプロセスをCtrl+Cで停止)

# データベースを復元
cd C:\Users\管理者ユーザー\Desktop\testproject
Remove-Item data\tests.db
Copy-Item data_backup_YYYYMMDD_HHMMSS\tests.db data\tests.db
```

**⚠️ 重要**: バックアップを取っていない場合は、現在のデータベースが破損している可能性があります。

### 手順 3: 正しい順序で実行

```powershell
cd C:\Users\管理者ユーザー\Desktop\testproject

# ステップ1: foldersテーブルの制約変更
node migrate-folder-unique-constraint.mjs

# ステップ2: testsテーブルの外部キー修正
node fix-tests-foreign-key.mjs

# ステップ3: test_foldersテーブルの外部キー修正
node fix-test-folders-foreign-key.mjs

# ステップ4: test_tagsテーブルの外部キー修正
node fix-test-tags-foreign-key.mjs

# ステップ5: test_attachmentsテーブルの外部キー修正
node fix-test-attachments-foreign-key.mjs

# 検証
node verify-migration.mjs
```

---

## 🎯 簡単な方法: 一括実行スクリプト

個別に実行する代わりに、すべてを自動で実行するスクリプトを使用できます:

```powershell
cd C:\Users\管理者ユーザー\Desktop\testproject

# すべてのマイグレーションを順番に実行
node run-all-migrations.mjs
```

このスクリプトは:

- ✅ 正しい順序で実行
- ✅ エラーが発生したら自動停止
- ✅ どのステップで失敗したか表示

---

## 📋 必要なファイルリスト

本番環境に以下のファイルがすべて配置されているか確認してください:

### マイグレーションスクリプト(必須)

- [ ] `migrate-folder-unique-constraint.mjs`
- [ ] `fix-tests-foreign-key.mjs`
- [ ] `fix-test-folders-foreign-key.mjs`
- [ ] `fix-test-tags-foreign-key.mjs`
- [ ] `fix-test-attachments-foreign-key.mjs`

### 補助スクリプト(推奨)

- [ ] `run-all-migrations.mjs` - 一括実行用
- [ ] `verify-migration.mjs` - 検証用
- [ ] `check-migration-status.mjs` - 状態確認用

### ファイルが不足している場合

開発環境から本番環境にコピー:

```powershell
# 開発環境で実行(PowerShell)
$files = @(
    "migrate-folder-unique-constraint.mjs",
    "fix-tests-foreign-key.mjs",
    "fix-test-folders-foreign-key.mjs",
    "fix-test-tags-foreign-key.mjs",
    "fix-test-attachments-foreign-key.mjs",
    "run-all-migrations.mjs",
    "verify-migration.mjs",
    "check-migration-status.mjs"
)

$destination = "C:\Users\管理者ユーザー\Desktop\testproject\"

foreach ($file in $files) {
    Copy-Item $file $destination
    Write-Host "✓ Copied: $file"
}

Write-Host "`n✅ すべてのファイルをコピーしました"
```

---

## 🔧 トラブルシューティング

### Q: バックアップを取っていない場合は?

**A**: 現在のデータベースの状態次第です:

1. `check-migration-status.mjs` を実行して状態を確認
2. ステップ 1 から順番に実行できる状態なら、そのまま実行
3. 中途半端な状態の場合は、手動でテーブル構造を修正する必要があります

### Q: データが消えることはありますか?

**A**: いいえ、マイグレーションスクリプトはすべて:

- データをバックアップしてから変更
- トランザクションで実行(エラー時は自動ロールバック)
- データを保持したまま構造のみ変更

ただし、**念のため必ずバックアップを取ってから実行してください。**

### Q: エラーが出た場合は?

**A**: 以下の順番で確認:

1. エラーメッセージを確認
2. `check-migration-status.mjs` で現在の状態を確認
3. 必要に応じてバックアップから復元
4. 正しい順序で再実行

---

## 📞 サポート

問題が解決しない場合:

1. `check-migration-status.mjs` の出力をコピー
2. エラーメッセージ全体をコピー
3. 開発担当者に連絡

---

## ✅ 成功の確認

すべてのマイグレーションが完了したら:

```powershell
# 検証を実行
node verify-migration.mjs
```

以下の出力が表示されれば成功:

```
🎉 すべての検証に合格しました!
✅ マイグレーションは正常に完了しています
✅ テスト作成機能が正常に動作するはずです
```

その後、アプリケーションを起動:

```powershell
npm run dev
```

---

**⚠️ 重要な注意事項**

1. **バックアップは必須** - 作業前に必ずデータベースをバックアップ
2. **順序を守る** - ステップ 1→2→3→4→5 の順番を変えない
3. **エラー時は停止** - エラーが出たら次のステップに進まない
4. **検証する** - 完了後に必ず verify-migration.mjs で確認

---

**このガイドに従って、本番環境でマイグレーションを正しく実行してください。**
