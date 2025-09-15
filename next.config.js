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
    // CSS最適化
    optimizeCss: true,
    // パッケージインポート最適化
    optimizePackageImports: ['crypto-js', '@supabase/supabase-js'],
  },
  // Optimize for production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Webpack最適化設定
  webpack: (config, { isServer }) => {
    // バンドル分割最適化
    if (!isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks.cacheGroups,
          // Supabaseライブラリを分割
          supabase: {
            name: 'supabase',
            test: /[\\/]node_modules[\\/]@supabase[\\/]/,
            priority: 30,
            reuseExistingChunk: true,
            chunks: 'all',
          },
          // crypto-jsライブラリを分割
          crypto: {
            name: 'crypto',
            test: /[\\/]node_modules[\\/]crypto-js[\\/]/,
            priority: 25,
            reuseExistingChunk: true,
            chunks: 'all',
          },
          // ゲームロジック関連を分割
          gameLogic: {
            name: 'game-logic',
            test: /[\\/]src[\\/]lib[\\/](gameLogic|napoleonRules|scoring)[\\/]/,
            priority: 20,
            reuseExistingChunk: true,
            chunks: 'all',
          },
          // AI関連を分割
          aiLogic: {
            name: 'ai-logic',
            test: /[\\/]src[\\/]lib[\\/]ai[\\/]/,
            priority: 15,
            reuseExistingChunk: true,
            chunks: 'all',
          },
        },
      }
    }
    return config
  },
}

module.exports = nextConfig
