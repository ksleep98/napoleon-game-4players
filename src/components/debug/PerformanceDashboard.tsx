'use client'

/**
 * Performance Dashboard - 開発用パフォーマンス監視UI
 */

import { useCallback, useEffect, useState } from 'react'
import { performanceMonitor } from '@/lib/performance/monitor'
import { performanceComparator } from '@/lib/supabase/performanceClient'
import { EnvironmentDebug } from './EnvironmentDebug'

interface TestResults {
  environment: string
  timestamp: number
  tests: {
    connectionTest: {
      latency: number
      dbLatency: number
      authLatency: number
      success: boolean
    }
    simpleQuery: number
    complexQuery: number
    updateOperation: number
    realtimeLatency: number
    cacheTest?: {
      firstCall: number
      cachedCall: number
      improvement: number
    }
    optimizedQueries?: {
      roomSearch: number
      playerSearch: number
      gameStats: number
    }
    cacheStats?: {
      hitRate: number
      totalEntries: number
      memoryUsage: string
    }
  }
}

interface StatsData {
  environment: string
  count: number
  average: number
  median: number
  p95: number
  min: number
  max: number
  recentMetrics: Array<{
    name: string
    duration: number
    timestamp: number
  }>
  envComparison: Record<
    string,
    {
      count: number
      average: number
      median: number
      p95: number
    }
  >
}

export function PerformanceDashboard() {
  const [isVisible, setIsVisible] = useState(false)
  const [stats, setStats] = useState<StatsData | null>(null)
  const [testResults, setTestResults] = useState<TestResults | null>(null)
  const [isRunningTests, setIsRunningTests] = useState(false)

  const updateStats = useCallback(() => {
    const currentStats = performanceMonitor.getStats()
    const envComparison = performanceMonitor.getEnvironmentComparison()
    setStats({ ...currentStats, envComparison })
  }, [])

  const runPerformanceTests = async () => {
    setIsRunningTests(true)
    try {
      const results = await performanceComparator.runPerformanceTests()
      setTestResults(results)
      console.log(performanceComparator.formatTestResults(results))
    } catch (error) {
      console.error('Performance test failed:', error)
    } finally {
      setIsRunningTests(false)
    }
  }

  useEffect(() => {
    updateStats()
    const interval = setInterval(updateStats, 5000) // 5秒毎に更新
    return () => clearInterval(interval)
  }, [updateStats])

  // 開発環境またはパフォーマンス監視が有効な場合のみ表示
  if (
    process.env.NODE_ENV !== 'development' &&
    process.env.NEXT_PUBLIC_ENABLE_PERF_MONITOR !== 'true'
  ) {
    return null
  }

  const getPerformanceColor = (
    value: number,
    thresholds = { good: 100, ok: 500 }
  ) => {
    if (value <= thresholds.good) return 'text-green-600'
    if (value <= thresholds.ok) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <>
      {/* トグルボタン */}
      <button
        type="button"
        onClick={() => setIsVisible(!isVisible)}
        className="fixed top-4 right-4 z-50 bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-mono hover:bg-gray-700 transition-colors"
        style={{ fontSize: '12px' }}
      >
        📊 Perf
      </button>

      {/* ダッシュボード */}
      {isVisible && (
        <div className="fixed top-16 right-4 z-40 bg-white border border-gray-300 rounded-lg shadow-xl p-4 max-w-sm w-80 max-h-96 overflow-y-auto">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              🔍 Performance Monitor
            </h3>

            {stats && (
              <div className="space-y-3 text-sm">
                {/* 環境情報 */}
                <div className="bg-blue-50 p-2 rounded">
                  <div className="font-semibold text-blue-800">
                    Environment: {stats.environment.toUpperCase()}
                  </div>
                  <div className="text-blue-600">
                    Measurements: {stats.count}
                  </div>
                </div>

                {/* パフォーマンス統計 */}
                {stats.count > 0 && (
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="font-semibold text-gray-800 mb-1">
                      Response Times:
                    </div>
                    <div className={`${getPerformanceColor(stats.average)}`}>
                      Avg: {stats.average.toFixed(1)}ms
                    </div>
                    <div className={`${getPerformanceColor(stats.median)}`}>
                      Median: {stats.median.toFixed(1)}ms
                    </div>
                    <div className={`${getPerformanceColor(stats.p95)}`}>
                      95th: {stats.p95.toFixed(1)}ms
                    </div>
                    <div className="text-gray-600">
                      Range: {stats.min.toFixed(1)}ms - {stats.max.toFixed(1)}ms
                    </div>
                  </div>
                )}

                {/* 環境比較 */}
                {Object.keys(stats.envComparison).length > 1 && (
                  <div className="bg-yellow-50 p-2 rounded">
                    <div className="font-semibold text-yellow-800 mb-1">
                      Environment Comparison:
                    </div>
                    {Object.entries(stats.envComparison).map(([env, data]) => (
                      <div key={env} className="text-sm">
                        <span className="font-medium">
                          {env.toUpperCase()}:
                        </span>
                        <span
                          className={`ml-1 ${getPerformanceColor(data.average)}`}
                        >
                          {data.average.toFixed(1)}ms avg
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 最新の測定結果 */}
                {stats.recentMetrics?.length > 0 && (
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="font-semibold text-gray-800 mb-1">
                      Recent:
                    </div>
                    <div className="max-h-20 overflow-y-auto text-xs">
                      {stats.recentMetrics.slice(-5).map((metric) => (
                        <div
                          key={`${metric.name}-${metric.timestamp}`}
                          className="flex justify-between"
                        >
                          <span className="truncate">{metric.name}</span>
                          <span
                            className={`${getPerformanceColor(metric.duration)}`}
                          >
                            {metric.duration.toFixed(1)}ms
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* テスト実行ボタン */}
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={runPerformanceTests}
                disabled={isRunningTests}
                className={`w-full px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isRunningTests
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isRunningTests
                  ? 'Running Tests...'
                  : '🧪 Run Performance Test'}
              </button>

              {testResults && (
                <div className="bg-green-50 p-2 rounded text-sm">
                  <div className="font-semibold text-green-800 mb-1">
                    Latest Test Results:
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Connection:</span>
                      <span
                        className={getPerformanceColor(
                          testResults.tests.connectionTest.latency
                        )}
                      >
                        {testResults.tests.connectionTest.latency.toFixed(1)}ms
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Simple Query:</span>
                      <span
                        className={getPerformanceColor(
                          testResults.tests.simpleQuery
                        )}
                      >
                        {testResults.tests.simpleQuery.toFixed(1)}ms
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Complex Query:</span>
                      <span
                        className={getPerformanceColor(
                          testResults.tests.complexQuery,
                          { good: 200, ok: 1000 }
                        )}
                      >
                        {testResults.tests.complexQuery.toFixed(1)}ms
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Update Op:</span>
                      <span
                        className={getPerformanceColor(
                          testResults.tests.updateOperation
                        )}
                      >
                        {testResults.tests.updateOperation.toFixed(1)}ms
                      </span>
                    </div>
                    {testResults.tests.cacheTest && (
                      <div className="border-t pt-1 mt-1">
                        <div className="font-medium text-green-700 mb-1">
                          Cache Performance:
                        </div>
                        <div className="flex justify-between">
                          <span>1st Call:</span>
                          <span className="text-yellow-600">
                            {testResults.tests.cacheTest.firstCall.toFixed(1)}
                            ms
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cached:</span>
                          <span className="text-green-600">
                            {testResults.tests.cacheTest.cachedCall.toFixed(1)}
                            ms
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Improvement:</span>
                          <span className="text-blue-600 font-medium">
                            {testResults.tests.cacheTest.improvement}%
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 最適化されたクエリ結果 */}
                    {testResults.tests.optimizedQueries && (
                      <div className="border-t pt-1 mt-1">
                        <div className="font-medium text-blue-700 mb-1">
                          Optimized Queries:
                        </div>
                        <div className="flex justify-between">
                          <span>Room Search:</span>
                          <span
                            className={getPerformanceColor(
                              testResults.tests.optimizedQueries.roomSearch
                            )}
                          >
                            {testResults.tests.optimizedQueries.roomSearch.toFixed(
                              1
                            )}
                            ms
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Player Search:</span>
                          <span
                            className={getPerformanceColor(
                              testResults.tests.optimizedQueries.playerSearch
                            )}
                          >
                            {testResults.tests.optimizedQueries.playerSearch.toFixed(
                              1
                            )}
                            ms
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Game Stats:</span>
                          <span
                            className={getPerformanceColor(
                              testResults.tests.optimizedQueries.gameStats,
                              { good: 150, ok: 300 }
                            )}
                          >
                            {testResults.tests.optimizedQueries.gameStats.toFixed(
                              1
                            )}
                            ms
                          </span>
                        </div>
                      </div>
                    )}

                    {/* キャッシュ統計 */}
                    {testResults.tests.cacheStats && (
                      <div className="border-t pt-1 mt-1">
                        <div className="font-medium text-purple-700 mb-1">
                          Cache Statistics:
                        </div>
                        <div className="flex justify-between">
                          <span>Hit Rate:</span>
                          <span
                            className={
                              testResults.tests.cacheStats.hitRate >= 80
                                ? 'text-green-600'
                                : testResults.tests.cacheStats.hitRate >= 50
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                            }
                          >
                            {testResults.tests.cacheStats.hitRate}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Entries:</span>
                          <span className="text-gray-600">
                            {testResults.tests.cacheStats.totalEntries}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Memory:</span>
                          <span className="text-gray-600">
                            {testResults.tests.cacheStats.memoryUsage}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => performanceMonitor.clearMetrics()}
                  className="flex-1 px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                >
                  Clear Data
                </button>
                <button
                  type="button"
                  onClick={() =>
                    console.log(performanceMonitor.generateReport())
                  }
                  className="flex-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
                >
                  Export Log
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * パフォーマンス測定開始用のフック
 * ページロード時に自動的に基本測定を開始
 */
export function usePerformanceMonitoring() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    console.log('📊 Performance monitoring initialized')
    console.log('💡 Use window.__perfMonitor to access performance data')

    // 初期接続テストを実行
    const runInitialTest = async () => {
      try {
        await performanceComparator.runPerformanceTests()
      } catch (error) {
        console.warn('Initial performance test failed:', error)
      }
    }

    // 1秒後に実行（初期化完了後）
    setTimeout(runInitialTest, 1000)
  }, [])
}

/**
 * Next.jsページに簡単に組み込めるコンポーネント
 */
export function PerformanceProvider({
  children,
}: {
  children: React.ReactNode
}) {
  usePerformanceMonitoring()

  return (
    <>
      {children}
      <PerformanceDashboard />
      <EnvironmentDebug />
    </>
  )
}
