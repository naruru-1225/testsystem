import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 軽量化のため、画像最適化を無効化(必要に応じて有効化可能)
  images: {
    unoptimized: true,
  },

  // Capacitor用の設定
  // output: "export", を有効にする場合は以下の制限があります:
  // - API Routes (/app/api/*) は使用不可
  // - headers(), redirects(), rewrites() は使用不可
  // - Dynamic Routes with getStaticPaths が必要
  //
  // 推奨: バックエンドAPIを別サーバーとして起動し、フロントエンドのみ静的エクスポート
  // output: "export",

  // PDFファイルの配信設定
  // 注意: output: "export" を有効にする場合、この設定は無効になります
  async headers() {
    return [
      {
        source: "/uploads/:path*",
        headers: [
          {
            key: "Content-Type",
            value: "application/pdf",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Range",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
