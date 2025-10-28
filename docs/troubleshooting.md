# トラブルシューティングガイド

テスト管理システムで発生する可能性のあるエラーと、その対処法をまとめています。

## 目次

1. [起動時のエラー](#起動時のエラー)
2. [データベース関連のエラー](#データベース関連のエラー)
3. [ネットワーク関連のエラー](#ネットワーク関連のエラー)
4. [ブラウザ表示のエラー](#ブラウザ表示のエラー)
5. [パフォーマンスの問題](#パフォーマンスの問題)

---

## 起動時のエラー

### エラー1: `npm: command not found` または `'npm' は、内部コマンドまたは外部コマンド...として認識されていません。`

**原因**: Node.jsがインストールされていない、またはPATHが通っていない

**対処法**:

1. Node.jsがインストールされているか確認
   ```powershell
   node --version
   ```

2. インストールされていない場合
   - [Node.js公式サイト](https://nodejs.org/)からLTS版をダウンロード
   - インストール後、PowerShellを再起動

3. インストール済みでもエラーが出る場合
   - PowerShellを管理者権限で再起動
   - 環境変数PATHにNode.jsのパスが含まれているか確認

**確認手順**:
```powershell
# 環境変数の確認
$env:Path -split ';' | Select-String "nodejs"
```

### エラー2: `Error: listen EADDRINUSE: address already in use :::3000`

**原因**: ポート3000が既に他のアプリケーションで使用されている

**対処法1**: 使用中のプロセスを終了

```powershell
# ポート3000を使用しているプロセスを確認
netstat -ano | findstr :3000

# 出力例:
# TCP    0.0.0.0:3000      0.0.0.0:0       LISTENING       12345
# この場合、PIDは12345

# プロセスを終了(PIDは上記で確認した番号)
taskkill /PID 12345 /F
```

**対処法2**: 別のポートを使用

```powershell
# ポート3001で起動
$env:PORT=3001; npm run dev
```

アクセスURLも変更: `http://localhost:3001`

### エラー3: `MODULE_NOT_FOUND` エラー

**原因**: 依存パッケージがインストールされていない

**対処法**:

```powershell
# node_modulesを削除
Remove-Item -Recurse -Force node_modules

# package-lock.jsonも削除
Remove-Item package-lock.json

# 再インストール
npm install
```

### エラー4: `better-sqlite3` のビルドエラー

**Windows環境のエラー例**:
```
gyp ERR! build error
gyp ERR! stack Error: `C:\Program Files (x86)\MSBuild\14.0\bin\msbuild.exe`
```

**原因**: C++のビルドツールがインストールされていない

**対処法**:

1. **管理者権限のPowerShell**で実行:

   ```powershell
   npm install -g windows-build-tools
   ```

   **所要時間**: 10〜30分

2. インストール後、プロジェクトの再インストール:

   ```powershell
   npm install
   ```

**macOS環境の場合**:

```bash
# Xcode Command Line Toolsのインストール
xcode-select --install

# 再インストール
npm install
```

**Linux環境の場合**:

```bash
# ビルドツールのインストール
sudo apt-get update
sudo apt-get install build-essential python3

# 再インストール
npm install
```

---

## データベース関連のエラー

### エラー5: `SqliteError: unable to open database file`

**原因**: dataディレクトリへの書き込み権限がない、またはディレクトリが存在しない

**対処法**:

1. **dataディレクトリの確認と作成**:

   ```powershell
   # ディレクトリの存在確認
   Test-Path "data"

   # 存在しない場合は作成
   New-Item -ItemType Directory -Path "data"
   ```

2. **権限の確認** (macOS/Linux):

   ```bash
   # 権限の確認
   ls -la data/

   # 権限の変更
   chmod 755 data/
   chmod 644 data/tests.db
   ```

3. **Windows の場合**:
   - dataフォルダを右クリック → プロパティ
   - セキュリティタブで「読み取り」「書き込み」権限を確認

### エラー6: `SqliteError: database is locked`

**原因**: データベースファイルが他のプロセスで使用中、または異常終了により ロックファイルが残っている

**対処法**:

1. **サーバーを完全に停止**:
   - PowerShellで `Ctrl + C`
   - タスクマネージャーでNode.jsプロセスを確認し、終了

2. **ロックファイルの削除**:

   ```powershell
   # ロックファイルを削除
   Remove-Item data\tests.db-shm -ErrorAction SilentlyContinue
   Remove-Item data\tests.db-wal -ErrorAction SilentlyContinue
   ```

3. **再起動**:

   ```powershell
   npm run dev
   ```

### エラー7: データが表示されない、またはサンプルデータがない

**原因**: データベースの初期化が失敗している

**対処法**:

1. **データベースの再初期化**:

   ```powershell
   # 既存のデータベースをバックアップ(必要な場合)
   Copy-Item data\tests.db data\tests.db.backup

   # データベースファイルを削除
   Remove-Item data\tests.db*

   # サーバーを起動(自動的に再作成)
   npm run dev
   ```

2. **ブラウザでリロード**:
   - `Ctrl + F5` でキャッシュをクリアしてリロード

---

## ネットワーク関連のエラー

### エラー8: タブレットからアクセスできない

**原因**: ファイアウォールがポート3000をブロックしている

**対処法1**: Windowsファイアウォールの設定

1. **Windows セキュリティ**を開く
2. **ファイアウォールとネットワーク保護** → **詳細設定**
3. **受信の規則** → **新しい規則**
4. 以下の設定:
   - 規則の種類: **ポート**
   - プロトコル: **TCP**
   - 特定のローカルポート: **3000**
   - 操作: **接続を許可する**
   - プロファイル: **すべて選択**
   - 名前: **Next.js Development Server**

**対処法2**: PowerShellで設定(管理者権限)

```powershell
New-NetFirewallRule -DisplayName "Next.js Dev Server" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

**対処法3**: PCとタブレットのネットワーク確認

```powershell
# PCのIPアドレスを確認
ipconfig

# 出力例から「IPv4 アドレス」をメモ
# 例: 192.168.1.100
```

タブレットで `http://[IPアドレス]:3000` にアクセス

### エラー9: `ERR_CONNECTION_REFUSED`

**原因**: サーバーが起動していない、またはポート番号が間違っている

**対処法**:

1. **サーバーの起動確認**:
   - PowerShellでサーバーが起動中か確認
   - `✓ Ready in ...` のメッセージを確認

2. **URLの確認**:
   - `http://localhost:3000` (ローカル)
   - `http://[IPアドレス]:3000` (他の端末)
   - **https**ではなく **http** を使用

3. **ポート番号の確認**:
   - サーバー起動時に表示されるポート番号を確認

---

## ブラウザ表示のエラー

### エラー10: 画面が真っ白になる

**原因**: JavaScriptエラー、またはビルドエラー

**対処法**:

1. **ブラウザのコンソールを確認**:
   - `F12` キーを押す
   - Consoleタブでエラーメッセージを確認

2. **開発サーバーのログを確認**:
   - PowerShellのエラーメッセージを確認

3. **ハードリロード**:
   - `Ctrl + Shift + R` (Windows)
   - `Cmd + Shift + R` (macOS)

4. **サーバーの再起動**:
   ```powershell
   # Ctrl + C でサーバー停止
   npm run dev
   ```

### エラー11: スタイルが適用されない

**原因**: Tailwind CSSのビルドエラー

**対処法**:

1. **.next フォルダの削除**:

   ```powershell
   Remove-Item -Recurse -Force .next
   npm run dev
   ```

2. **キャッシュのクリア**:
   - ブラウザで `Ctrl + Shift + Delete`
   - キャッシュをクリア

### エラー12: テーブルが横にスクロールできない(モバイル)

**原因**: タッチイベントが無効化されている

**対処法**:

1. **ブラウザの設定確認**:
   - アクセシビリティ設定でタッチ操作が有効か確認

2. **別のブラウザで試す**:
   - Chrome, Safari, Firefoxなど

---

## パフォーマンスの問題

### エラー13: 動作が遅い、レスポンスが悪い

**原因**: 大量のデータ、メモリ不足

**対処法**:

1. **データ量の確認**:
   ```powershell
   # データベースサイズの確認
   (Get-Item data\tests.db).Length / 1MB
   ```

2. **ブラウザのタブを閉じる**:
   - 他のタブを閉じてメモリを解放

3. **開発ツールを閉じる**:
   - F12で開いた開発者ツールを閉じる

4. **PC再起動**:
   - メモリリークの可能性がある場合

### エラー14: 検索が遅い

**原因**: データベースインデックスが効いていない

**対処法**:

現在のバージョンではインデックスが設定されています。データベースを再初期化することで改善する可能性があります:

```powershell
# データベースのバックアップ
Copy-Item data\tests.db data\tests.db.old

# 削除
Remove-Item data\tests.db*

# 再起動(自動的に最適化された状態で再作成)
npm run dev
```

---

## その他のエラー

### エラー15: `EPERM: operation not permitted`

**原因**: ファイルの書き込み権限がない

**対処法**:

1. **管理者権限でPowerShellを起動**

2. **ウイルス対策ソフトの確認**:
   - リアルタイム保護が干渉している可能性
   - プロジェクトフォルダを除外リストに追加

3. **ファイルが使用中でないか確認**:
   - エクスプローラーやエディタで該当ファイルを開いていないか確認

### エラー16: TypeScriptのコンパイルエラー

**エラー例**:
```
Type error: Cannot find module '@/components/...'
```

**対処法**:

1. **tsconfig.jsonの確認**:
   - `paths`設定が正しいか確認

2. **エディタの再起動**:
   - VS Codeなどのエディタを再起動

3. **TypeScriptサーバーの再起動** (VS Code):
   - `Ctrl + Shift + P`
   - "TypeScript: Restart TS Server" を選択

### エラー17: メモリ不足エラー

**エラー例**:
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**対処法**:

1. **Node.jsのメモリ上限を増やす**:

   ```powershell
   $env:NODE_OPTIONS="--max-old-space-size=4096"; npm run dev
   ```

2. **PC のメモリを確認**:
   - タスクマネージャーでメモリ使用率を確認
   - 4GB以上の空きメモリが推奨

---

## 緊急時の対処

### 完全リセット手順

すべてが動作しない場合の最終手段:

```powershell
# 1. サーバー停止
# Ctrl + C

# 2. キャッシュとビルドファイルの削除
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force .next
Remove-Item package-lock.json

# 3. データベースのバックアップ(必要な場合)
Copy-Item data\tests.db data\tests.db.backup

# 4. 再インストール
npm install

# 5. 起動
npm run dev
```

---

## ログの確認方法

### サーバーログ

PowerShellに表示されるログを確認:

```
✓ Compiled /api/tests in 234ms
GET /api/tests 200 in 45ms
```

エラーの場合は詳細が表示されます。

### ブラウザログ

1. `F12` キーで開発者ツールを開く
2. **Console** タブでエラーを確認
3. **Network** タブでAPI通信を確認

### データベースログ

SQLiteはログファイルを作成しませんが、エラーはサーバーログに表示されます。

---

## サポートへの問い合わせ前のチェックリスト

問題が解決しない場合、以下の情報を準備してください:

- [ ] エラーメッセージの全文(スクリーンショット)
- [ ] 発生タイミング(起動時、操作時など)
- [ ] 環境情報
  - [ ] OS とバージョン
  - [ ] Node.js バージョン (`node --version`)
  - [ ] npm バージョン (`npm --version`)
- [ ] 実行したコマンド
- [ ] ブラウザのコンソールログ(F12 → Console)
- [ ] サーバーのログ(PowerShellの出力)

---

## 予防策

### 定期的なメンテナンス

1. **データベースのバックアップ** (週1回推奨):
   ```powershell
   Copy-Item -Path "data" -Destination "backup\data_$(Get-Date -Format 'yyyyMMdd')" -Recurse
   ```

2. **依存パッケージの更新** (月1回):
   ```powershell
   npm update
   ```

3. **ログファイルの確認**:
   - 異常なエラーが頻発していないか確認

### ベストプラクティス

- サーバーは使用後に必ず停止する
- データの削除前には必ずバックアップを取る
- OSやNode.jsは定期的に更新する
- ファイアウォール設定は必要最小限に
