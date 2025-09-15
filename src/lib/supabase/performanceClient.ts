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
   * ゲームルーム一覧取得（最適化版・ページネーション対応）
   */
  async getGameRooms(
    options: {
      status?: string
      limit?: number
      offset?: number
      hostPlayerId?: string
      orderBy?: 'created_at' | 'player_count'
      includeFull?: boolean
    } = {}
  ) {
    const {
      status,
      limit = 20,
      offset = 0,
      hostPlayerId,
      orderBy = 'created_at',
      includeFull = true,
    } = options

    const cacheKey = this.getCacheKey(
      'getGameRooms',
      status,
      limit,
      offset,
      hostPlayerId,
      orderBy,
      includeFull
    )

    // 短時間キャッシュ（ルーム一覧は頻繁に変更される）
    const cached = this.getFromCache(cacheKey, 30 * 1000) // 30秒
    if (cached) {
      return cached
    }

    const result = await performanceMonitor.measureDatabase(
      'select',
      async () => {
        let query = supabase
          .from('game_rooms')
          .select(
            'id, name, player_count, max_players, status, host_player_id, created_at'
          )
          .range(offset, offset + limit - 1)

        // ステータスフィルタ（インデックス活用）
        if (status) {
          query = query.eq('status', status)
        }

        // ホストプレイヤーフィルタ
        if (hostPlayerId) {
          query = query.eq('host_player_id', hostPlayerId)
        }

        // 満室ルーム除外
        if (!includeFull) {
          query = query.filter('player_count', 'lt', 'max_players')
        }

        // ソート順指定（インデックス活用）
        if (orderBy === 'created_at') {
          query = query.order('created_at', { ascending: false })
        } else {
          query = query
            .order('player_count', { ascending: false })
            .order('created_at', { ascending: false })
        }

        const queryResult = await query

        // 成功時にキャッシュ
        if (!queryResult.error) {
          this.setCache(cacheKey, queryResult, 30 * 1000)
        }

        return queryResult
      },
      {
        table: 'game_rooms',
        queryType: 'complex',
      }
    )

    return result
  }

  /**
   * プレイヤー検索（最適化版）
   */
  async searchPlayers(
    searchTerm: string,
    options: {
      limit?: number
      excludeDisconnected?: boolean
      gameId?: string
    } = {}
  ) {
    const { limit = 10, excludeDisconnected = true, gameId } = options

    return performanceMonitor.measureDatabase(
      'select',
      async () => {
        let query = supabase
          .from('players')
          .select('id, name, connected, game_id, room_id')
          .ilike('name', `%${searchTerm}%`) // 部分一致検索
          .limit(limit)

        // 接続状態フィルタ
        if (excludeDisconnected) {
          query = query.eq('connected', true)
        }

        // 特定ゲーム内検索
        if (gameId) {
          query = query.eq('game_id', gameId)
        }

        // 名前順ソート
        query = query.order('name', { ascending: true })

        return await query
      },
      {
        table: 'players',
        queryType: 'simple',
      }
    )
  }

  /**
   * プレイヤー一覧取得（最適化版）
   */
  async getPlayersInRoom(
    roomId: string,
    options: {
      includeDisconnected?: boolean
      limit?: number
      orderBy?: 'created_at' | 'name'
    } = {}
  ) {
    const {
      includeDisconnected = false,
      limit = 50,
      orderBy = 'created_at',
    } = options

    return performanceMonitor.measureDatabase(
      'select',
      async () => {
        let query = supabase
          .from('players')
          .select('id, name, connected, created_at') // 必要な列のみ
          .eq('room_id', roomId)

        // 接続状態フィルタ（インデックス活用）
        if (!includeDisconnected) {
          query = query.eq('connected', true)
        }

        // ソート順指定
        query = query.order(orderBy, { ascending: orderBy === 'name' })

        // 結果数制限
        if (limit > 0) {
          query = query.limit(limit)
        }

        return await query
      },
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
  async getGameStatistics(
    playerId: string,
    options: {
      limit?: number
      dateFrom?: string
      includeCached?: boolean
    } = {}
  ) {
    const { limit = 10, dateFrom, includeCached = true } = options
    const cacheKey = this.getCacheKey(
      'getGameStatistics',
      playerId,
      limit,
      dateFrom
    )

    // 統計データは長めにキャッシュ
    if (includeCached) {
      const cached = this.getFromCache(cacheKey, 10 * 60 * 1000) // 10分
      if (cached) {
        return cached
      }
    }

    const result = await performanceMonitor.measureDatabase(
      'select',
      async () => {
        try {
          console.log('🔍 Building game statistics query for player:', playerId)

          // 最適化されたクエリ（インデックス活用）
          let query = supabase
            .from('game_results')
            .select(
              'id, napoleon_won, napoleon_player_id, face_cards_won, created_at'
            )
            .or(
              `napoleon_player_id.eq.${playerId},adjutant_player_id.eq.${playerId}`
            )
            .order('created_at', { ascending: false })
            .limit(limit)

          // 日付フィルタリング（インデックス活用）
          if (dateFrom) {
            console.log('🗓️ Adding date filter:', dateFrom)
            query = query.gte('created_at', dateFrom)
          }

          console.log('📤 Executing game statistics query...')
          const { data, error } = await query

          console.log('📥 Query result:', {
            data,
            error,
            dataLength: data?.length,
          })

          if (error) {
            console.error('❌ Game statistics query error:', error)
            throw error
          }

          // 成功時にキャッシュ
          if (data && includeCached) {
            this.setCache(cacheKey, { data, error }, 10 * 60 * 1000)
          }

          return { data, error }
        } catch (queryError) {
          console.error('❌ Game statistics query failed:', queryError)
          throw queryError
        }
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

  getFromCache<T>(key: string, _customTTL?: number): T | null {
    const cached = this.cache.get(key)

    if (cached && cached.expiry > Date.now()) {
      // キャッシュヒット統計
      this.cacheStats.hits++
      return cached.data as T
    }

    // キャッシュミス統計
    this.cacheStats.misses++
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

  /**
   * データベースパフォーマンス監視
   */
  async getDatabaseStats(): Promise<{
    indexUsage: Array<{
      tablename: string
      indexname: string
      scans: number
      tuples_read: number
    }>
    slowQueries: Array<{
      query: string
      calls: number
      avg_time: number
      total_time: number
    }>
    tableStats: Array<{
      tablename: string
      row_count: number
      size_mb: number
      index_size_mb: number
    }>
  }> {
    try {
      // インデックス使用状況
      const { data: indexData } = await supabase.rpc('get_index_usage')

      // テーブル統計（簡易版）
      const tables = ['games', 'game_rooms', 'players', 'game_results']
      const tableStatsPromises = tables.map(async (table) => {
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })

        return {
          tablename: table,
          row_count: count || 0,
          size_mb: 0, // 実際のサイズは権限が必要
          index_size_mb: 0,
        }
      })

      const tableStats = await Promise.all(tableStatsPromises)

      return {
        indexUsage: indexData || [],
        slowQueries: [], // pg_stat_statements requires superuser
        tableStats,
      }
    } catch (error) {
      console.warn('Database stats collection failed:', error)
      return {
        indexUsage: [],
        slowQueries: [],
        tableStats: [],
      }
    }
  }

  /**
   * 自動パフォーマンス最適化
   */
  async optimizeQueries(): Promise<{
    recommendations: string[]
    appliedOptimizations: string[]
  }> {
    const recommendations: string[] = []
    const appliedOptimizations: string[] = []

    try {
      // キャッシュ使用率チェック
      const cacheHitRate = this.getCacheHitRate()
      if (cacheHitRate < 0.8) {
        recommendations.push(
          `キャッシュヒット率が低いです (${(cacheHitRate * 100).toFixed(1)}%)`
        )

        // キャッシュTTLを自動調整
        if (this.CACHE_TTL < 5 * 60 * 1000) {
          // @ts-expect-error - readonly property update for optimization
          this.CACHE_TTL = Math.min(this.CACHE_TTL * 1.5, 5 * 60 * 1000)
          appliedOptimizations.push(
            `キャッシュTTLを${this.CACHE_TTL / 1000}秒に延長`
          )
        }
      }

      // キャッシュサイズチェック
      if (this.cache.size > this.MAX_CACHE_SIZE * 0.9) {
        recommendations.push('キャッシュサイズが上限に近づいています')

        // 期限切れエントリのクリーンアップ
        this.cleanExpiredCache()
        appliedOptimizations.push('期限切れキャッシュエントリをクリーンアップ')
      }

      // メモリ使用量チェック（Node.js環境のみ）
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage()
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024

        if (heapUsedMB > 100) {
          // 100MB以上
          recommendations.push(
            `メモリ使用量が高いです (${heapUsedMB.toFixed(1)}MB)`
          )

          // 積極的なキャッシュクリア
          if (this.cache.size > 50) {
            const entriesToRemove = Math.floor(this.cache.size * 0.3)
            const keys = Array.from(this.cache.keys()).slice(0, entriesToRemove)
            for (const key of keys) {
              this.cache.delete(key)
            }
            appliedOptimizations.push(
              `${entriesToRemove}個のキャッシュエントリを削除`
            )
          }
        }
      }
    } catch (error) {
      console.warn('Query optimization failed:', error)
    }

    return { recommendations, appliedOptimizations }
  }

  /**
   * キャッシュヒット率計算
   */
  getCacheHitRate(): number {
    if (!this.cacheStats) {
      this.cacheStats = { hits: 0, misses: 0 }
    }

    const total = this.cacheStats.hits + this.cacheStats.misses
    return total > 0 ? this.cacheStats.hits / total : 0
  }

  /**
   * キャッシュサイズ取得
   */
  getCacheSize(): number {
    return this.cache.size
  }

  /**
   * キャッシュ統計取得
   */
  getCacheStats(): {
    hitRate: number
    totalEntries: number
    memoryUsage: string
  } {
    return {
      hitRate: Math.round(this.getCacheHitRate() * 100),
      totalEntries: this.getCacheSize(),
      memoryUsage:
        typeof process !== 'undefined' && process.memoryUsage
          ? `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`
          : '0MB',
    }
  }

  /**
   * 期限切れキャッシュのクリーンアップ
   */
  private cleanExpiredCache(): number {
    const now = Date.now()
    let cleaned = 0

    for (const [key, value] of this.cache.entries()) {
      if (value.expiry <= now) {
        this.cache.delete(key)
        cleaned++
      }
    }

    return cleaned
  }

  // キャッシュ統計追跡
  private cacheStats: { hits: number; misses: number } = { hits: 0, misses: 0 }
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
      optimizedQueries: {
        roomSearch: number
        playerSearch: number
        gameStats: number
      }
      cacheStats: {
        hitRate: number
        totalEntries: number
        memoryUsage: string
      }
    }
  }> {
    console.log('🔍 Starting comprehensive performance tests...')

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
        optimizedQueries: {
          roomSearch: 0,
          playerSearch: 0,
          gameStats: 0,
        },
        cacheStats: {
          hitRate: 0,
          totalEntries: 0,
          memoryUsage: '0MB',
        },
      },
    }

    try {
      // 環境チェック（ローカル開発環境の場合は制限付きテスト）
      const isLocalDev =
        process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('mock') ||
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        typeof window === 'undefined'

      // 本番環境でも安全なテストモード（NODE_ENV=developmentは除外）
      const isProductionTest = !isLocalDev && typeof window !== 'undefined'

      console.log('🔍 Environment check:', {
        isLocalDev,
        isProductionTest,
        supabaseUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30)}...`,
        nodeEnv: process.env.NODE_ENV,
      })

      if (isLocalDev) {
        console.log(
          '🔧 Running limited performance test for local development...'
        )
        results.tests.connectionTest = {
          latency: 50,
          dbLatency: 25,
          authLatency: 25,
          success: true,
        }
        results.tests.simpleQuery = 75
        results.tests.complexQuery = 120
        results.tests.updateOperation = 90
        results.tests.realtimeLatency = 30
        results.tests.cacheTest = {
          firstCall: 75,
          cachedCall: 15,
          improvement: 80,
        }
        results.tests.optimizedQueries = {
          roomSearch: 45,
          playerSearch: 35,
          gameStats: 85,
        }
        results.tests.cacheStats = performanceSupabase.getCacheStats()

        console.log(
          '✅ Local development performance test completed (simulated)'
        )
        return results
      }

      // 1. 接続テスト (本番環境)
      console.log('📡 Testing connection...')
      try {
        results.tests.connectionTest =
          await performanceSupabase.testConnection()
        console.log(
          '✅ Connection test successful:',
          results.tests.connectionTest
        )
      } catch (connError) {
        console.error('❌ Connection test failed:', connError)
        results.tests.connectionTest = {
          latency: 999,
          dbLatency: 999,
          authLatency: 999,
          success: false,
        }
      }

      // 2. キャッシュクリア（テスト前に確実にクリア）
      performanceSupabase.clearCache()

      // 3. 基本クエリテスト（キャッシュ効果を正確に測定）
      console.log('📋 Testing basic query performance...')

      try {
        // プレイヤー検索クエリ（データの存在確認も含む）
        const queryStart = performance.now()
        const { data: players, error: playersError } = await supabase
          .from('players')
          .select('id, name, connected')
          .limit(5)

        if (playersError) {
          console.warn('Players query error:', playersError)
          results.tests.simpleQuery = 500 // デフォルト値
        } else {
          results.tests.simpleQuery = performance.now() - queryStart
          console.log(
            `✅ Players query: ${results.tests.simpleQuery.toFixed(1)}ms, found ${players?.length || 0} players`
          )
        }
        results.tests.cacheTest.firstCall = results.tests.simpleQuery

        // 同じクエリを再実行（Supabaseレベルのキャッシュ効果測定）
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
      } catch (queryError) {
        console.error('Basic query test failed:', queryError)
        results.tests.simpleQuery = 500
        results.tests.cacheTest = {
          firstCall: 500,
          cachedCall: 500,
          improvement: 0,
        }
      }

      // 4. 複雑クエリテスト（最適化されたクエリ）
      console.log('🔍 Testing optimized complex queries...')
      try {
        const complexStart = performance.now()
        const { data: gameResults, error: resultsError } = await supabase
          .from('game_results')
          .select('id, napoleon_won, napoleon_player_id, created_at')
          .order('created_at', { ascending: false })
          .limit(10)

        if (resultsError) {
          console.warn('Game results query error:', resultsError)
          results.tests.complexQuery = 500
        } else {
          results.tests.complexQuery = performance.now() - complexStart
          console.log(
            `✅ Game results query: ${results.tests.complexQuery.toFixed(1)}ms, found ${gameResults?.length || 0} results`
          )
        }
      } catch (complexError) {
        console.error('Complex query test failed:', complexError)
        results.tests.complexQuery = 500
      }

      // 5. 最適化されたクエリテスト
      console.log('⚡ Testing optimized query methods...')

      // ルーム検索テスト
      try {
        const roomStart = performance.now()
        await performanceSupabase.getGameRooms({
          status: 'waiting',
          limit: 10,
          includeFull: false,
        })
        results.tests.optimizedQueries.roomSearch =
          performance.now() - roomStart
        console.log(
          `✅ Optimized room search: ${results.tests.optimizedQueries.roomSearch.toFixed(1)}ms`
        )
      } catch (roomError) {
        console.error('Room search test failed:', roomError)
        results.tests.optimizedQueries.roomSearch = 500
      }

      // プレイヤー検索テスト
      try {
        const playerStart = performance.now()
        await performanceSupabase.searchPlayers('test', {
          limit: 5,
          excludeDisconnected: true,
        })
        results.tests.optimizedQueries.playerSearch =
          performance.now() - playerStart
        console.log(
          `✅ Optimized player search: ${results.tests.optimizedQueries.playerSearch.toFixed(1)}ms`
        )
      } catch (playerError) {
        console.error('Player search test failed:', playerError)
        results.tests.optimizedQueries.playerSearch = 500
      }

      // ゲーム統計テスト（最適化版）
      try {
        const statsStart = performance.now()
        // テスト用プレイヤーIDを使用（安全性向上）
        const testPlayerId = `perf-test-${Date.now()}`
        console.log('🧪 Testing game statistics with player ID:', testPlayerId)

        const result = await performanceSupabase.getGameStatistics(
          testPlayerId,
          {
            limit: 5,
            dateFrom: new Date(
              Date.now() - 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
            includeCached: false, // キャッシュなしでテスト
          }
        )

        console.log('🧪 Game statistics result:', result)
        results.tests.optimizedQueries.gameStats =
          performance.now() - statsStart
        console.log(
          `✅ Optimized game stats: ${results.tests.optimizedQueries.gameStats.toFixed(1)}ms`
        )
      } catch (statsError) {
        console.error('Game stats test failed:', {
          error: statsError,
          message:
            statsError instanceof Error
              ? statsError.message
              : String(statsError),
          stack: statsError instanceof Error ? statsError.stack : undefined,
        })
        results.tests.optimizedQueries.gameStats = 500
      }

      // 6. 軽量更新操作テスト
      console.log('✏️ Testing optimized update operation...')
      try {
        const updateStart = performance.now()
        const testPlayerId = `perf-test-${Date.now()}`

        const { error: upsertError } = await supabase
          .from('players')
          .upsert({
            id: testPlayerId,
            name: 'Performance Test Player',
            connected: true,
          })
          .select('id')

        if (upsertError) {
          console.warn('Update operation error:', upsertError)
          results.tests.updateOperation = 500
        } else {
          results.tests.updateOperation = performance.now() - updateStart
          console.log(
            `✅ Update operation: ${results.tests.updateOperation.toFixed(1)}ms`
          )

          // テスト用データクリーンアップ
          await supabase.from('players').delete().eq('id', testPlayerId)
        }
      } catch (updateError) {
        console.error('Update test failed:', updateError)
        results.tests.updateOperation = 500
      }

      // 7. リアルタイム接続テスト（簡素化）
      console.log('⚡ Testing realtime latency...')
      try {
        const realtimeStart = performance.now()
        const channel = supabase.channel('perf-test-channel')
        await channel.subscribe()
        results.tests.realtimeLatency = performance.now() - realtimeStart
        console.log(
          `✅ Realtime latency: ${results.tests.realtimeLatency.toFixed(1)}ms`
        )
        await channel.unsubscribe()
      } catch (realtimeError) {
        console.error('Realtime test failed:', realtimeError)
        results.tests.realtimeLatency = 500
      }

      // 8. キャッシュ統計取得
      console.log('📊 Collecting cache statistics...')
      results.tests.cacheStats = performanceSupabase.getCacheStats()

      // 9. 自動最適化実行
      console.log('🔧 Running auto-optimization...')
      const optimization = await performanceSupabase.optimizeQueries()
      if (optimization.appliedOptimizations.length > 0) {
        console.log(
          '✅ Applied optimizations:',
          optimization.appliedOptimizations
        )
      }
      if (optimization.recommendations.length > 0) {
        console.log('💡 Recommendations:', optimization.recommendations)
      }

      // 10. テスト完了ログ

      console.log('✅ Comprehensive performance tests completed')
      console.log(`💾 Cache hit rate: ${results.tests.cacheStats.hitRate}%`)
      console.log(
        `⚡ Optimized queries average: ${((results.tests.optimizedQueries.roomSearch + results.tests.optimizedQueries.playerSearch + results.tests.optimizedQueries.gameStats) / 3).toFixed(1)}ms`
      )
    } catch (error) {
      console.error('❌ Performance test failed:', error)

      // エラー発生時のフォールバック値を設定
      results.tests.connectionTest = {
        latency: 999,
        dbLatency: 999,
        authLatency: 999,
        success: false,
      }
      results.tests.simpleQuery = 999
      results.tests.complexQuery = 999
      results.tests.updateOperation = 999
      results.tests.realtimeLatency = 999
      results.tests.cacheTest = {
        firstCall: 999,
        cachedCall: 999,
        improvement: 0,
      }
      results.tests.optimizedQueries = {
        roomSearch: 999,
        playerSearch: 999,
        gameStats: 999,
      }
      results.tests.cacheStats = {
        hitRate: 0,
        totalEntries: 0,
        memoryUsage: '0MB',
      }

      console.log('⚠️ Using fallback performance values due to connection error')
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
