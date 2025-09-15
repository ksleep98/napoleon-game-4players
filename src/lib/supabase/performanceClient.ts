/**
 * Performance-aware Supabase Client
 * 全てのデータベース操作にパフォーマンス測定を追加
 */

import { performanceMonitor } from '@/lib/performance/monitor'
import type { Database } from './client'
import { supabase } from './client'

/**
 * パフォーマンス測定付きSupabaseクライアント
 */
/**
 * パフォーマンス測定付きSupabaseクライアント
 */
class PerformanceSupabaseClient {
  // より効率的なキャッシュ実装
  private cache = new Map<string, { data: unknown; expiry: number }>()
  private readonly CACHE_TTL = 2 * 60 * 1000 // 2分に短縮
  private readonly MAX_CACHE_SIZE = 100 // キャッシュサイズ制限

  /**
   * ゲーム状態の取得（測定付き）
   */
  async getGameState(gameId: string) {
    return performanceMonitor.measureDatabase(
      'select',
      async () =>
        await supabase.from('games').select('*').eq('id', gameId).single(),
      {
        table: 'games',
        queryType: 'simple',
      }
    )
  }

  /**
   * ゲーム状態の更新（測定付き）
   */
  async updateGameState(
    gameId: string,
    updates: Database['public']['Tables']['games']['Update']
  ) {
    // キャッシュ無効化
    this.invalidateCache('getGameState', gameId)

    return performanceMonitor.measureDatabase(
      'update',
      async () =>
        await supabase
          .from('games')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', gameId)
          .select(),
      {
        table: 'games',
        queryType: 'simple',
      }
    )
  }

  /**
   * ゲームルーム取得（最適化されたキャッシュ付き）
   */
  async getGameRoom(roomId: string) {
    const cacheKey = this.getCacheKey('getGameRoom', roomId)

    // キャッシュチェック（より効率的）
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return cached
    }

    const result = await performanceMonitor.measureDatabase(
      'select',
      async () => {
        // より効率的なクエリ（必要な列のみ選択）
        const queryResult = await supabase
          .from('game_rooms')
          .select('id, name, player_count, max_players, status, host_player_id')
          .eq('id', roomId)
          .single()

        // 成功時のみキャッシュに保存
        if (!queryResult.error) {
          this.setCache(cacheKey, queryResult)
        }

        return queryResult
      },
      {
        table: 'game_rooms',
        queryType: 'simple',
      }
    )

    return result
  }

  /**
   * プレイヤー一覧取得（最適化版）
   */
  async getPlayersInRoom(roomId: string) {
    return performanceMonitor.measureDatabase(
      'select',
      async () =>
        await supabase
          .from('players')
          .select('id, name, connected') // 必要な列のみ
          .eq('room_id', roomId)
          .eq('connected', true)
          .order('created_at', { ascending: true }),
      {
        table: 'players',
        queryType: 'simple',
      }
    )
  }

  /**
   * プレイヤー状態更新（最適化版）
   */
  async updatePlayerConnection(playerId: string, connected: boolean) {
    // 関連キャッシュを無効化
    this.invalidateCacheByPattern('getPlayersInRoom')

    return performanceMonitor.measureDatabase(
      'update',
      async () =>
        await supabase
          .from('players')
          .update({ connected })
          .eq('id', playerId)
          .select('id, connected'), // 必要な列のみ返却
      {
        table: 'players',
        queryType: 'simple',
      }
    )
  }

  /**
   * 最適化された統計クエリ
   */
  async getGameStatistics(playerId: string) {
    const cacheKey = this.getCacheKey('getGameStatistics', playerId)

    // 統計データは長めにキャッシュ
    const cached = this.getFromCache(cacheKey, 10 * 60 * 1000) // 10分
    if (cached) {
      return cached
    }

    const result = await performanceMonitor.measureDatabase(
      'select',
      async () => {
        // インデックスを活用した最適化クエリ
        const { data, error } = await supabase
          .from('game_results')
          .select('id, napoleon_won, napoleon_player_id, scores, created_at')
          .contains('scores', [{ playerId }])
          .order('created_at', { ascending: false })
          .limit(20) // さらに制限

        if (error) throw error

        // 成功時にキャッシュ
        if (data) {
          this.setCache(cacheKey, { data, error }, 10 * 60 * 1000)
        }

        return { data, error }
      },
      {
        table: 'game_results',
        queryType: 'complex',
      }
    )

    return result
  }

  /**
   * バッチクエリ実行（複数操作の最適化）
   */
  async batchQueries<T>(queries: (() => Promise<T>)[]): Promise<T[]> {
    return performanceMonitor.measureDatabase(
      'batch',
      async () => Promise.all(queries.map((query) => query())),
      {
        table: 'batch_operations',
        queryType: 'complex',
      }
    )
  }

  /**
   * RPC関数呼び出し（最適化版）
   */
  async callRPC<T = unknown>(
    functionName: string,
    params: Record<string, unknown> = {}
  ): Promise<{ data: T | null; error: unknown }> {
    return performanceMonitor.measureDatabase(
      'rpc',
      async () => await supabase.rpc(functionName, params),
      {
        table: `rpc_${functionName}`,
        queryType: 'simple',
      }
    )
  }

  /**
   * リアルタイム接続（最適化版）
   */
  subscribeToGameState(
    gameId: string,
    callback: (payload: unknown) => void,
    errorCallback?: (error: Error) => void
  ) {
    const startTime = performance.now()
    const subscription = supabase
      .channel(`game_${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          performanceMonitor.measure(
            'realtime_game_update',
            () => Promise.resolve(callback(payload)),
            {
              gameId,
              operation: payload.eventType,
              latency: performance.now() - startTime,
            }
          )
        }
      )
      .on('broadcast', { event: 'error' }, (payload) => {
        if (errorCallback) {
          errorCallback(new Error(`Realtime error: ${String(payload)}`))
        }
      })
      .subscribe()

    return () => subscription.unsubscribe()
  }

  /**
   * 軽量接続テスト（最適化版）
   */
  async testConnection(): Promise<{
    latency: number
    dbLatency: number
    authLatency: number
    success: boolean
  }> {
    const results = {
      latency: 0,
      dbLatency: 0,
      authLatency: 0,
      success: false,
    }

    try {
      const totalStart = performance.now()

      // より軽量なDBテスト
      const dbStart = performance.now()
      const { error: dbError } = await supabase
        .from('players')
        .select('id') // 最小限の列
        .limit(1)
        .maybeSingle() // より効率的
      results.dbLatency = performance.now() - dbStart

      // セッション確認のみ（軽量）
      const authStart = performance.now()
      const { error: authError } = await supabase.auth.getSession()
      results.authLatency = performance.now() - authStart

      results.latency = performance.now() - totalStart
      results.success = !dbError && !authError

      await performanceMonitor.measure(
        'connection_test',
        () => Promise.resolve(results),
        {
          dbLatency: results.dbLatency,
          authLatency: results.authLatency,
          success: results.success,
        }
      )
    } catch (error) {
      console.error('Connection test failed:', error)
      results.success = false
    }

    return results
  }

  // 最適化されたキャッシュ管理
  getCacheKey(method: string, ...args: unknown[]): string {
    return `${method}:${JSON.stringify(args)}`
  }

  getFromCache<T>(key: string, customTTL?: number): T | null {
    const cached = this.cache.get(key)
    const ttl = customTTL || this.CACHE_TTL

    if (cached && cached.expiry > Date.now()) {
      return cached.data as T
    }

    this.cache.delete(key)
    return null
  }

  setCache<T>(key: string, data: T, customTTL?: number): void {
    // キャッシュサイズ制限
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    const ttl = customTTL || this.CACHE_TTL
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
    })
  }

  // キャッシュ無効化
  invalidateCache(method: string, ...args: unknown[]): void {
    const key = this.getCacheKey(method, ...args)
    this.cache.delete(key)
  }

  // パターンマッチングでキャッシュ無効化
  invalidateCacheByPattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  // キャッシュクリア
  clearCache(): void {
    this.cache.clear()
  }
}

// シングルトンインスタンス
export const performanceSupabase = new PerformanceSupabaseClient()

/**
 * 環境別パフォーマンス比較ユーティリティ
 */
export class PerformanceComparator {
  /**
   * 一連のテストを実行して環境比較データを生成
   */
  async runPerformanceTests(): Promise<{
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
      cacheTest: {
        firstCall: number
        cachedCall: number
        improvement: number
      }
    }
  }> {
    console.log('🔍 Starting enhanced performance tests...')

    const results = {
      environment: performanceMonitor.getStats().environment,
      timestamp: Date.now(),
      tests: {
        connectionTest: {
          latency: 0,
          dbLatency: 0,
          authLatency: 0,
          success: false,
        },
        simpleQuery: 0,
        complexQuery: 0,
        updateOperation: 0,
        realtimeLatency: 0,
        cacheTest: {
          firstCall: 0,
          cachedCall: 0,
          improvement: 0,
        },
      },
    }

    try {
      // 1. 接続テスト
      console.log('📡 Testing connection...')
      results.tests.connectionTest = await performanceSupabase.testConnection()

      // 2. キャッシュクリア（テスト前に確実にクリア）
      performanceSupabase.clearCache()

      // 3. 既存データを使ったクエリテスト（キャッシュ効果を正確に測定）
      console.log('📋 Testing query performance...')

      // プレイヤー検索クエリ（実際に存在するデータを使用）
      const queryStart = performance.now()
      await supabase.from('players').select('id, name, connected').limit(5)
      results.tests.simpleQuery = performance.now() - queryStart
      results.tests.cacheTest.firstCall = results.tests.simpleQuery

      // 同じクエリを再実行（キャッシュなし、Supabaseレベル）
      const cachedStart = performance.now()
      await supabase.from('players').select('id, name, connected').limit(5)
      results.tests.cacheTest.cachedCall = performance.now() - cachedStart

      // キャッシュ改善率計算
      results.tests.cacheTest.improvement = Math.round(
        ((results.tests.cacheTest.firstCall -
          results.tests.cacheTest.cachedCall) /
          results.tests.cacheTest.firstCall) *
          100
      )

      // 4. 複雑クエリテスト（game_resultsから統計データ取得）
      console.log('🔍 Testing complex query...')
      const complexStart = performance.now()
      await supabase
        .from('game_results')
        .select('id, napoleon_won, scores, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      results.tests.complexQuery = performance.now() - complexStart

      // 5. 軽量更新操作テスト（自分のプレイヤーレコード更新）
      console.log('✏️ Testing update operation...')
      const updateStart = performance.now()

      // テスト用プレイヤーを作成または更新
      const testPlayerId = `perf-test-${Date.now()}`
      await supabase
        .from('players')
        .upsert({
          id: testPlayerId,
          name: 'Performance Test Player',
          connected: true,
        })
        .select('id')

      results.tests.updateOperation = performance.now() - updateStart

      // 6. リアルタイム接続テスト（接続時間のみ）
      console.log('⚡ Testing realtime latency...')
      const realtimeStart = performance.now()
      const channel = supabase.channel('perf-test-channel')
      await channel.subscribe()
      results.tests.realtimeLatency = performance.now() - realtimeStart
      await channel.unsubscribe()

      // 7. テスト用データクリーンアップ
      await supabase.from('players').delete().eq('id', testPlayerId)

      console.log('✅ Enhanced performance tests completed')
      console.log(
        `💾 Network latency improvement: ${results.tests.cacheTest.improvement}%`
      )
    } catch (error) {
      console.error('❌ Performance test failed:', error)
    }

    return results
  }

  /**
   * テスト結果を整形して表示
   */
  formatTestResults(results: {
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
    }
  }): string {
    let report = `\n🎯 Performance Test Results (${results.environment.toUpperCase()})\n`
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    report += `🌐 Connection Test:\n`
    report += `  ├─ Total Latency: ${results.tests.connectionTest.latency.toFixed(2)}ms\n`
    report += `  ├─ Database: ${results.tests.connectionTest.dbLatency.toFixed(2)}ms\n`
    report += `  ├─ Auth: ${results.tests.connectionTest.authLatency.toFixed(2)}ms\n`
    report += `  └─ Success: ${results.tests.connectionTest.success ? '✅' : '❌'}\n\n`

    report += `📊 Query Performance:\n`
    report += `  ├─ Simple Query: ${results.tests.simpleQuery.toFixed(2)}ms\n`
    report += `  ├─ Complex Query: ${results.tests.complexQuery.toFixed(2)}ms\n`
    report += `  ├─ Update Operation: ${results.tests.updateOperation.toFixed(2)}ms\n`
    report += `  └─ Realtime Setup: ${results.tests.realtimeLatency.toFixed(2)}ms\n\n`

    const overallScore =
      (results.tests.connectionTest.latency +
        results.tests.simpleQuery +
        results.tests.complexQuery +
        results.tests.updateOperation) /
      4

    const rating =
      overallScore < 100
        ? '🟢 Excellent'
        : overallScore < 300
          ? '🟡 Good'
          : overallScore < 1000
            ? '🟠 Slow'
            : '🔴 Very Slow'

    report += `Overall Performance: ${overallScore.toFixed(2)}ms ${rating}\n`

    return report
  }
}

export const performanceComparator = new PerformanceComparator()
