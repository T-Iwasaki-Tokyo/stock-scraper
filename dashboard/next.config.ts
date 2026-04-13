import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    buildActivity: false,
    buildActivityPosition: 'bottom-right',
  },
  // メモリ使用量を削減するための設定
  experimental: {
    // 適切なキーがあればここに追加
  }
};



export default nextConfig;
