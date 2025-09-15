'use client'

/**
 * 最適化されたPerformanceDashboard（静的import版）
 * 🚀 5-15ms削減を目指す
 */

import { Suspense } from 'react'
import { EnvironmentDebug } from './EnvironmentDebug'
import { PerformanceDashboard } from './PerformanceDashboard'

// 軽量フォールバックコンポーネント
function PerformanceFallback() {
  return (
    <div className="fixed top-4 right-4 z-50 bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg text-sm">
      📊 Loading...
    </div>
  )
}

function DebugFallback() {
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-700 text-white px-2 py-1 rounded text-xs">
      🔧 Loading debug...
    </div>
  )
}

/**
 * 高速化されたパフォーマンスプロバイダー
 */
export function OptimizedPerformanceProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}

      {/* 開発環境またはパフォーマンス監視が有効な場合のみ表示 */}
      {(process.env.NODE_ENV === 'development' ||
        process.env.NEXT_PUBLIC_ENABLE_PERF_MONITOR === 'true') && (
        <>
          <Suspense fallback={<PerformanceFallback />}>
            <PerformanceDashboard />
          </Suspense>

          <Suspense fallback={<DebugFallback />}>
            <EnvironmentDebug />
          </Suspense>
        </>
      )}
    </>
  )
}

/**
 * 高速化されたパフォーマンス監視フック
 */
export function useOptimizedPerformanceMonitoring() {
  // 最小限の初期化のみ実行
  if (typeof window !== 'undefined') {
    console.log('⚡ Optimized performance monitoring initialized')

    // パフォーマンス API の活用
    if ('performance' in window && 'mark' in performance) {
      performance.mark('napoleon-game-start')
    }
  }
}
