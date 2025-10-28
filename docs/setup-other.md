# 他の環境での実行手順

このドキュメントでは、別の PC 環境でテスト管理システムを実行する手順を説明します。

## システム要件

### 最小要件

- **OS**: Windows 10/11, macOS 10.15 以上, Linux (Ubuntu 20.04 以上推奨)
- **CPU**: 2 コア以上
- **メモリ**: 4GB 以上
- **ストレージ**: 500MB 以上の空き容量
- **ネットワーク**: インターネット接続(初回セットアップ時)

### 推奨要件

- **OS**: Windows 11, macOS 12 以上, Ubuntu 22.04 以上
- **CPU**: 4 コア以上
- **メモリ**: 8GB 以上
- **ストレージ**: 1GB 以上の空き容量

## 事前準備

### 1. Node.js のインストール

#### Windows

1. [Node.js 公式サイト](https://nodejs.org/)にアクセス
2. LTS 版(推奨版)をダウンロード
3. インストーラーを実行
4. デフォルト設定でインストール

**確認方法** (PowerShell またはコマンドプロンプト):

```powershell
node --version
npm --version
```

#### macOS

**方法 1: 公式インストーラー**

1. [Node.js 公式サイト](https://nodejs.org/)からダウンロード
2. .pkg ファイルを実行してインストール

**方法 2: Homebrew 使用**

```bash
brew install node
```

**確認方法** (ターミナル):

```bash
node --version
npm --version
```

#### Linux (Ubuntu/Debian)

```bash
# Node.jsの公式リポジトリを追加
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# インストール
sudo apt-get install -y nodejs

# 確認
node --version
npm --version
```

### 2. Git のインストール(オプション)

プロジェクトを Git で管理する場合は、Git をインストールします。

#### Windows

1. [Git 公式サイト](https://git-scm.com/)からダウンロード
2. インストーラーを実行(デフォルト設定推奨)

#### macOS

```bash
brew install git
```

#### Linux

```bash
sudo apt-get install git
```

## プロジェクトのセットアップ

### 方法 1: ファイルのコピーによる移行

#### 手順

1. **プロジェクトファイルの取得**

   現在の環境から、以下のディレクトリ全体をコピー:

   ```
   f:\naruk\デスクトップ\app_dev\test_app\1
   ```

   **コピー除外するもの**:

   - `node_modules` フォルダ
   - `.next` フォルダ
   - `data/tests.db-shm`, `data/tests.db-wal` (ある場合)

   **コピー必須のもの**:

   - すべての`.ts`, `.tsx`, `.json`, `.css`ファイル
   - `data/tests.db` (既存データを引き継ぐ場合)

2. **新しい環境への配置**

   任意のディレクトリに配置:

   **Windows 例**:

   ```
   C:\projects\test-management-system
   ```

   **macOS/Linux 例**:

   ```
   ~/projects/test-management-system
   ```

3. **ディレクトリに移動**

   **Windows (PowerShell)**:

   ```powershell
   cd C:\projects\test-management-system
   ```

   **macOS/Linux (ターミナル)**:

   ```bash
   cd ~/projects/test-management-system
   ```

4. **依存パッケージのインストール**

   ```bash
   npm install
   ```

   **所要時間**: 環境により 3〜10 分

5. **開発サーバーの起動**

   ```bash
   npm run dev
   ```

6. **動作確認**

   ブラウザで `http://localhost:3000` にアクセス

### 方法 2: Git による移行(推奨)

#### 現在の環境での準備

1. **Git リポジトリの初期化**

   ```powershell
   cd "f:\naruk\デスクトップ\app_dev\test_app\1"
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **リモートリポジトリへのプッシュ**(GitHub など使用)

   ```powershell
   git remote add origin [リポジトリURL]
   git branch -M main
   git push -u origin main
   ```

#### 新しい環境での手順

1. **リポジトリのクローン**

   ```bash
   git clone [リポジトリURL] test-management-system
   cd test-management-system
   ```

2. **依存パッケージのインストール**

   ```bash
   npm install
   ```

3. **データベースの初期化**

   初回起動時、サンプルデータ入りの DB が自動生成されます。

4. **開発サーバーの起動**

   ```bash
   npm run dev
   ```

## ネットワーク設定

### ローカルネットワークでの公開

#### Windows

1. **ファイアウォール設定**

   ```powershell
   # 管理者権限のPowerShellで実行
   New-NetFirewallRule -DisplayName "Next.js Dev Server" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
   ```

2. **IP アドレスの確認**

   ```powershell
   ipconfig
   ```

   `IPv4 アドレス` をメモ (例: 192.168.1.100)

3. **他の端末からのアクセス**

   ```
   http://[IPアドレス]:3000
   ```

#### macOS

1. **IP アドレスの確認**

   ```bash
   ifconfig | grep "inet "
   ```

2. **ファイアウォール設定**

   - システム環境設定 → セキュリティとプライバシー → ファイアウォール
   - 「ファイアウォールオプション」
   - 「node」を許可リストに追加

#### Linux

1. **IP アドレスの確認**

   ```bash
   ip addr show
   ```

2. **ファイアウォール設定** (ufw の場合)

   ```bash
   sudo ufw allow 3000/tcp
   ```

### 本番環境での運用

**注意**: 現在の設定は開発環境用です。本番環境で運用する場合は以下が必要です:

1. **本番ビルドの作成**

   ```bash
   npm run build
   npm run start
   ```

2. **環境変数の設定**

   `.env.local`ファイルを作成:

   ```
   NODE_ENV=production
   PORT=3000
   ```

3. **プロセスマネージャーの使用** (PM2 推奨)

   ```bash
   # PM2のインストール
   npm install -g pm2

   # ビルド
   npm run build

   # PM2で起動
   pm2 start npm --name "test-system" -- start

   # 自動起動設定
   pm2 startup
   pm2 save
   ```

## データの移行

### 既存データの移行

1. **データベースファイルのコピー**

   現在の環境から `data/tests.db` をコピー

2. **新しい環境への配置**

   プロジェクトディレクトリ内の `data/` フォルダに配置

3. **権限の確認** (macOS/Linux)

   ```bash
   chmod 644 data/tests.db
   ```

### データの初期化

新規にセットアップする場合、初回起動時に自動的にサンプルデータが作成されます。

既存のデータを削除して初期化する場合:

```bash
# データベースファイルを削除
rm -f data/tests.db*   # macOS/Linux
Remove-Item data\tests.db*   # Windows PowerShell

# サーバーを起動すると自動的に再作成
npm run dev
```

## 動作確認チェックリスト

セットアップ後、以下を確認してください:

- [ ] サーバーが正常に起動する
- [ ] ブラウザで画面が表示される
- [ ] サイドバーにフォルダ一覧が表示される
- [ ] テスト一覧が表示される
- [ ] 検索機能が動作する
- [ ] フォルダをクリックしてフィルタリングができる
- [ ] レスポンシブデザインが機能する(画面サイズを変更)

## トラブルシューティング

### Node.js のバージョンが古い

**エラー**: `SyntaxError: Unexpected token`など

**解決方法**:

1. Node.js を最新の LTS 版にアップデート
2. プロジェクトを再セットアップ

### ポート 3000 が使用中

**解決方法 1**: 別のポートを使用

**Windows**:

```powershell
$env:PORT=3001; npm run dev
```

**macOS/Linux**:

```bash
PORT=3001 npm run dev
```

**解決方法 2**: 使用中のプロセスを停止

**Windows**:

```powershell
netstat -ano | findstr :3000
taskkill /PID [プロセスID] /F
```

**macOS/Linux**:

```bash
lsof -ti:3000 | xargs kill -9
```

### better-sqlite3 のインストールエラー

**症状**: ネイティブモジュールのビルドエラー

**解決方法**:

**Windows**:

1. Windows Build Tools をインストール
   ```powershell
   npm install -g windows-build-tools
   ```
2. 再インストール
   ```powershell
   npm install
   ```

**macOS**:

1. Xcode Command Line Tools をインストール
   ```bash
   xcode-select --install
   ```

**Linux**:

```bash
sudo apt-get install build-essential python3
npm install
```

### 権限エラー (macOS/Linux)

**症状**: `EACCES` エラー

**解決方法**:

```bash
# npm のグローバルディレクトリを変更
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'

# .bashrc または .zshrc に追加
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

## セキュリティ考慮事項

### ローカルネットワーク限定での運用

- インターネットに直接公開しない
- VPN やファイアウォールで保護されたネットワーク内でのみ使用
- 定期的なデータバックアップの実施

### アクセス制限

今後の機能追加で、以下の実装を推奨:

- ログイン機能
- ユーザー権限管理
- アクセスログの記録

## サポート

問題が発生した場合:

1. `docs/troubleshooting.md` を確認
2. エラーメッセージをメモ
3. ブラウザのコンソール(F12)を確認
4. サーバーのログを確認
