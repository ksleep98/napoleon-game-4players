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
  // Security headers for production
  async headers() {
    if (process.env.NODE_ENV === 'production') {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'X-Frame-Options',
              value: 'DENY',
            },
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff',
            },
            {
              key: 'Referrer-Policy',
              value: 'origin-when-cross-origin',
            },
            {
              key: 'X-XSS-Protection',
              value: '1; mode=block',
            },
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=31536000; includeSubDomains',
            },
          ],
        },
      ]
    }
    return []
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

    // Docker環境でのホットリロード対応
    if (process.env.NODE_ENV === 'development') {
      config.watchOptions = {
        poll: 1000, // ファイル変更を1秒ごとにチェック
        aggregateTimeout: 300, // 変更検知後300ms待機してからリビルド
        ignored: /node_modules/,
      }
    }

    return config
  },
}

module.exports = nextConfig
