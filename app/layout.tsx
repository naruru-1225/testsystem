import type { Metadata, Viewport } from "next";
import "./globals.css";

// メタデータ設定
export const metadata: Metadata = {
  title: "テスト管理システム",
  description: "塾内テスト管理システム",
};

// ビューポート設定
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
