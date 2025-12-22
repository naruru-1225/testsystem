# Capacitor Android 化ガイド

## 📋 概要

このドキュメントでは、Next.js テスト管理システムを Capacitor を使用して Android アプリ化する手順を説明します。

## ⚠️ 重要な制約

### Next.js `output: "export"` の制限

静的エクスポート(`output: "export"`)では以下の機能が使用できません:

❌ **使用不可:**

- API Routes (`/app/api/*`)
- `headers()`, `redirects()`, `rewrites()`
- Server Actions
- Dynamic Routes (getStaticPaths なし)
- Image Optimization (デフォルト)

✅ **使用可能:**

- クライアントサイドレンダリング
- Static Site Generation (SSG)
- Client-side Data Fetching

## 🎯 推奨アーキテクチャ

### アプローチ 1: ハイブリッド構成（推奨）

```
┌─────────────────────────────────────┐
│  Androidアプリ (Capacitor)           │
│  - 静的フロントエンド (HTML/CSS/JS)   │
│  - WebView                          │
└──────────────┬──────────────────────┘
               │ HTTP API
               ▼
┌─────────────────────────────────────┐
│  バックエンドサーバー (Next.js)       │
│  - API Routes (/api/*)              │
│  - SQLite Database                  │
│  - ファイルストレージ                 │
└─────────────────────────────────────┘
```

**利点:**

- ✅ すべての API 機能が使える
- ✅ データベースアクセスが可能
- ✅ ファイルアップロード/ダウンロードが可能
- ✅ 既存コードの変更が最小限

**欠点:**

- ❌ バックエンドサーバーが必要（ローカルネットワークまたはクラウド）
- ❌ 完全オフラインでは動作しない

---

## 🔧 セットアップ手順

### ステップ 1: Capacitor インストール

```bash
npm install @capacitor/core
npm install -D @capacitor/cli
npx cap init
```

**入力内容:**

```
? App name: テスト管理システム
? App Package ID: com.yourcompany.testmanagement
? (Optional) Web asset directory: out
```

### ステップ 2: Android プラットフォーム追加

```bash
npm install @capacitor/android
npx cap add android
```

### ステップ 3: 設定ファイル修正

#### `capacitor.config.ts`

```typescript
import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.yourcompany.testmanagement",
  appName: "テスト管理システム",
  webDir: "out",
  server: {
    // 開発環境: ローカルネットワークのAPIサーバーを指定
    url: "http://192.168.1.64:3000",
    cleartext: true, // HTTP通信を許可
  },
  android: {
    allowMixedContent: true, // HTTP/HTTPS混在を許可
  },
};

export default config;
```

#### `next.config.ts`

**オプション A: API Routes を使用する場合（推奨）**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },

  // output: "export" は使用しない（API Routes を維持）

  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,POST,PUT,DELETE,OPTIONS",
          },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

**オプション B: 完全静的エクスポート（API Routes 不使用）**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // headers() は使用不可
};

export default nextConfig;
```

### ステップ 4: ビルドとデプロイ

#### オプション A: ハイブリッド構成

1. **バックエンドサーバー起動**

   ```bash
   npm run dev
   # または本番環境
   npm run build
   npm start
   ```

2. **フロントエンドビルド**

   新しい`package.json`スクリプトを追加:

   ```json
   {
     "scripts": {
       "build:mobile": "next build && next export",
       "cap:sync": "cap sync",
       "cap:open": "cap open android"
     }
   }
   ```

   ただし、`next export`は Next.js 13.5 以降非推奨です。代わりに:

   ```json
   {
     "scripts": {
       "build:standalone": "next build",
       "cap:sync": "cap sync",
       "cap:open": "cap open android"
     }
   }
   ```

3. **Android ビルド**
   ```bash
   npm run build:standalone
   npx cap sync
   npx cap open android
   ```

#### オプション B: 完全静的エクスポート

1. **静的ファイル生成**

   ```bash
   npm run build
   # outディレクトリに静的ファイルが生成される
   ```

2. **Android ビルド**
   ```bash
   npx cap sync
   npx cap open android
   ```

---

## 📱 Android 固有の設定

### `android/app/src/main/AndroidManifest.xml`

ネットワーク通信を許可:

```xml
<application
    android:usesCleartextTraffic="true"
    ...>
```

### ネットワーク権限

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

---

## 🌐 API 接続の設定

### 環境変数を使用

#### `.env.local`

```
NEXT_PUBLIC_API_URL=http://192.168.1.64:3000/api
```

#### コンポーネントで使用

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

fetch(`${API_URL}/tests`)
  .then((res) => res.json())
  .then((data) => console.log(data));
```

---

## 🔄 開発ワークフロー

### 開発環境

1. **バックエンド起動**

   ```bash
   npm run dev
   ```

2. **Capacitor Live Reload**

   ```typescript
   // capacitor.config.ts
   server: {
     url: 'http://192.168.1.64:3000',
     cleartext: true,
   }
   ```

3. **Android エミュレーター起動**
   ```bash
   npx cap run android
   ```

### 本番ビルド

1. **最適化ビルド**

   ```bash
   npm run build
   ```

2. **APK 生成**
   ```bash
   npx cap sync
   npx cap open android
   # Android Studio で Build → Build Bundle(s) / APK(s) → Build APK(s)
   ```

---

## 🐛 トラブルシューティング

### エラー: `Failed to collect page data for /api/tests`

**原因:** `output: "export"`と API Routes の共存不可

**解決策:**

1. `output: "export"`を削除
2. バックエンドを別サーバーとして起動
3. `capacitor.config.ts`で API サーバー URL を指定

### エラー: `CORS policy` エラー

**解決策:** `next.config.ts`に CORS 設定を追加

```typescript
async headers() {
  return [
    {
      source: "/api/:path*",
      headers: [
        { key: "Access-Control-Allow-Origin", value: "*" },
        { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
      ],
    },
  ];
}
```

### エラー: `Cleartext HTTP traffic not permitted`

**解決策:** `AndroidManifest.xml`で許可

```xml
<application android:usesCleartextTraffic="true">
```

---

## 📊 パフォーマンス最適化

### 画像最適化

```typescript
images: {
  unoptimized: true, // 静的エクスポート用
}
```

### コード分割

```typescript
import dynamic from "next/dynamic";

const PdfViewer = dynamic(() => import("@/components/PdfViewer"), {
  ssr: false,
});
```

---

## 🔐 セキュリティ考慮事項

### ローカルネットワーク限定

- バックエンド API はローカルネットワークのみからアクセス可能にする
- ファイアウォール設定でポート 3000 を制限

### データ暗号化

- SQLite データベースの暗号化を検討
- ファイルアップロードの暗号化

---

## 📚 参考資料

- [Capacitor 公式ドキュメント](https://capacitorjs.com/docs)
- [Next.js Static Exports](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [Capacitor with Next.js](https://capacitorjs.com/docs/guides/nextjs)

---

## ✅ チェックリスト

- [ ] Capacitor インストール完了
- [ ] `capacitor.config.ts`設定完了
- [ ] Android プラットフォーム追加
- [ ] バックエンド API サーバー起動
- [ ] CORS 設定追加
- [ ] AndroidManifest.xml 設定
- [ ] ビルド成功
- [ ] エミュレーターで動作確認
- [ ] 実機で動作確認

---

## 🎯 次のステップ

1. **データベース対応**: SQLite を Android ローカルストレージに移行
2. **オフライン対応**: Service Worker と IndexedDB 実装
3. **プッシュ通知**: Capacitor Push Notifications
4. **ネイティブ機能**: カメラ、ファイルピッカーなど
