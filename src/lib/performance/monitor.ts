/**
 * Performance Monitor - 遅延測定・分析ユーティリティ
 * Vercel vs ローカル環境の性能差分析用
 */

export interface PerformanceMetric {
  name: string
  duration: number
  timestamp: number
  environment: 'local' | 'vercel' | 'unknown'
  metadata?: Record<string, unknown>
}

export interface DatabaseMetric extends PerformanceMetric {
  operation: 'select' | 'insert' | 'update' | 'delete' | 'rpc'
  table?: string
  rowCount?: number
  queryType: 'simple' | 'complex' | 'realtime'
}

export interface APIMetric extends PerformanceMetric {
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  statusCode?: number
  responseSize?: number
}

export interface EnvironmentStats {
  count: number
  average: number
  median: number
  p95: number
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private isEnabled: boolean
  private environment: 'local' | 'vercel' | 'unknown'

  constructor() {
    this.isEnabled =
      process.env.NODE_ENV === 'development' ||
      process.env.NEXT_PUBLIC_ENABLE_PERF_MONITOR === 'true'

    // 環境判定
    if (typeof window !== 'undefined') {
      this.environment = window.location.hostname.includes('vercel.app')
        ? 'vercel'
        : window.location.hostname === 'localhost'
          ? 'local'
          : 'unknown'
    } else {
      this.environment = process.env.VERCEL ? 'vercel' : 'local'
    }
  }

  /**
   * 処理時間を測定する汎用ラッパー
   */
  async measure<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    if (!this.isEnabled) {
      return operation()
    }

    const startTime = performance.now()
    const startTimestamp = Date.now()

    try {
      const result = await operation()
      const duration = performance.now() - startTime

      this.recordMetric({
        name,
        duration,
        timestamp: startTimestamp,
        environment: this.environment,
        metadata: {
          ...metadata,
          success: true,
        },
      })

      return result
    } catch (error) {
      const duration = performance.now() - startTime

      this.recordMetric({
        name,
        duration,
        timestamp: startTimestamp,
        environment: this.environment,
        metadata: {
          ...metadata,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })

      throw error
    }
  }

  /**
   * データベース操作の測定
   */
  async measureDatabase<T>(
    operation: string,
    query: () => Promise<T>,
    options: {
      table?: string
      queryType?: 'simple' | 'complex' | 'realtime'
      expectedRows?: number
    } = {}
  ): Promise<T> {
    const name = `db_${operation}_${options.table || 'unknown'}`

    return this.measure(
      name,
      async () => {
        const result = await query()

        return result
      },
      {
        operation: operation as DatabaseMetric['operation'],
        table: options.table,
        queryType: options.queryType || 'simple',
        rowCount: 0,
      }
    )
  }

  /**
   * API呼び出しの測定
   */
  async measureAPI<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    apiCall: () => Promise<T>
  ): Promise<T> {
    const name = `api_${method}_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`

    return this.measure(name, apiCall, {
      endpoint,
      method,
    })
  }

  /**
   * メトリクスを記録
   */
  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric)

    // 開発環境ではコンソールに出力
    if (process.env.NODE_ENV === 'development') {
      const color =
        metric.duration > 1000 ? '🔴' : metric.duration > 500 ? '🟡' : '🟢'
      console.log(
        `${color} [${this.environment.toUpperCase()}] ${metric.name}: ${metric.duration.toFixed(2)}ms`,
        metric.metadata
      )
    }

    // 最新1000件のみ保持
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  /**
   * パフォーマンス統計を取得
   */
  getStats(nameFilter?: string): {
    count: number
    average: number
    min: number
    max: number
    median: number
    p95: number
    environment: string
    recentMetrics: PerformanceMetric[]
  } {
    const filtered = this.metrics.filter(
      (m) => !nameFilter || m.name.includes(nameFilter)
    )

    if (filtered.length === 0) {
      return {
        count: 0,
        average: 0,
        min: 0,
        max: 0,
        median: 0,
        p95: 0,
        environment: this.environment,
        recentMetrics: [],
      }
    }

    const durations = filtered.map((m) => m.duration).sort((a, b) => a - b)
    const sum = durations.reduce((a, b) => a + b, 0)

    return {
      count: filtered.length,
      average: sum / filtered.length,
      min: durations[0],
      max: durations[durations.length - 1],
      median: durations[Math.floor(durations.length / 2)],
      p95: durations[Math.floor(durations.length * 0.95)],
      environment: this.environment,
      recentMetrics: filtered.slice(-10),
    }
  }

  /**
   * 環境別比較データを取得
   */
  getEnvironmentComparison(): Record<string, EnvironmentStats> {
    const byEnv = this.metrics.reduce(
      (acc, metric) => {
        if (!acc[metric.environment]) {
          acc[metric.environment] = []
        }
        acc[metric.environment].push(metric.duration)
        return acc
      },
      {} as Record<string, number[]>
    )

    const comparison: Record<string, EnvironmentStats> = {}

    for (const [env, durations] of Object.entries(byEnv)) {
      const sorted = durations.sort((a, b) => a - b)
      comparison[env] = {
        count: sorted.length,
        average: sorted.reduce((a, b) => a + b, 0) / sorted.length,
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
      }
    }

    return comparison
  }

  /**
   * レポート生成
   */
  generateReport(): string {
    const stats = this.getStats()
    const envComparison = this.getEnvironmentComparison()

    let report = `🔍 Performance Report (${this.environment})\n`
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    report += `Total Measurements: ${stats.count}\n`
    report += `Average Response Time: ${stats.average.toFixed(2)}ms\n`
    report += `Median: ${stats.median.toFixed(2)}ms\n`
    report += `95th Percentile: ${stats.p95.toFixed(2)}ms\n`
    report += `Min/Max: ${stats.min.toFixed(2)}ms / ${stats.max.toFixed(2)}ms\n\n`

    if (Object.keys(envComparison).length > 1) {
      report += `📊 Environment Comparison:\n`
      for (const [env, data] of Object.entries(envComparison)) {
        report += `  ${env.toUpperCase()}: avg ${data.average.toFixed(2)}ms, p95 ${data.p95.toFixed(2)}ms\n`
      }
    }

    return report
  }

  /**
   * メトリクスをクリア
   */
  clearMetrics(): void {
    this.metrics = []
  }
}

// シングルトンインスタンス
export const performanceMonitor = new PerformanceMonitor()

// 開発者向けユーティリティ
if (typeof window !== 'undefined') {
  // biome-ignore lint/suspicious/noExplicitAny: Global debug utility
  ;(window as any).__perfMonitor = performanceMonitor
}
