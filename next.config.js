/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Optimized for Vercel deployment with Server Actions support
  experimental: {
    dynamicIO: false,
    // CSS最適化 - 一時的に無効化 (critters依存関係の問題のため)
    // optimizeCss: true,
    // パッケージインポート最適化
    optimizePackageImports: ['@supabase/supabase-js'],
  },
  // Optimize for production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Webpack最適化設定
  webpack: (config, { isServer }) => {
    // バンドル分割最適化（簡素化）
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            reuseExistingChunk: true,
          },
          // Supabaseライブラリを分割
          supabase: {
            name: 'supabase',
            test: /[\\/]node_modules[\\/]@supabase[\\/]/,
            priority: 30,
            reuseExistingChunk: true,
          },
        },
      }
    }
    return config
  },
}

module.exports = nextConfig
