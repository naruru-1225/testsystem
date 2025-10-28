import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 軽量化のため、画像最適化を無効化(必要に応じて有効化可能)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
