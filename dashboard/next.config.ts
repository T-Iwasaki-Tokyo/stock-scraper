import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    position: 'bottom-right',
  },


  // 外部パッケージとして扱うことでバンドルサイズとメモリを節約
  serverExternalPackages: ['playwright', 'playwright-core'],

  // メモリ使用量を削減するための設定
  experimental: {
    webpackMemoryOptimizations: true,
  }
};



export default nextConfig;
