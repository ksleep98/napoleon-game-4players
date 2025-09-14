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
class PerformanceSupabaseClient {
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
   * ゲームルーム取得（測定付き）
   */
  async getGameRoom(roomId: string) {
    return performanceMonitor.measureDatabase(
      'select',
      async () =>
        await supabase.from('game_rooms').select('*').eq('id', roomId).single(),
      {
        table: 'game_rooms',
        queryType: 'simple',
      }
    )
  }

  /**
   * プレイヤー一覧取得（測定付き）
   */
  async getPlayersInRoom(roomId: string) {
    return performanceMonitor.measureDatabase(
      'select',
      async () =>
        await supabase
          .from('players')
          .select('*')
          .eq('room_id', roomId)
          .eq('connected', true),
      {
        table: 'players',
        queryType: 'simple',
      }
    )
  }

  /**
   * プレイヤー状態更新（測定付き）
   */
  async updatePlayerConnection(playerId: string, connected: boolean) {
    return performanceMonitor.measureDatabase(
      'update',
      async () =>
        await supabase.from('players').update({ connected }).eq('id', playerId),
      {
        table: 'players',
        queryType: 'simple',
      }
    )
  }

  /**
   * 複雑なクエリ：ゲーム統計取得（測定付き）
   */
  async getGameStatistics(playerId: string) {
    return performanceMonitor.measureDatabase(
      'select',
      async () =>
        await supabase
          .from('game_results')
          .select(`
          id,
          napoleon_won,
          napoleon_player_id,
          adjutant_player_id,
          scores,
          created_at,
          games!inner(
            id,
            phase,
            created_at
          )
        `)
          .contains('scores', [{ playerId }]),
      {
        table: 'game_results',
        queryType: 'complex',
      }
    )
  }

  /**
   * RPC関数呼び出し（測定付き）
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
   * リアルタイム接続（測定付き）
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
          // リアルタイム受信の測定
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
   * 接続テスト（レイテンシ測定）
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
      // 1. 基本接続テスト
      const totalStart = performance.now()

      // 2. データベース接続テスト
      const dbStart = performance.now()
      const { error: dbError } = await supabase
        .from('players')
        .select('count')
        .limit(1)
      results.dbLatency = performance.now() - dbStart

      // 3. 認証接続テスト（セッション確認）
      const authStart = performance.now()
      const { error: authError } = await supabase.auth.getSession()
      results.authLatency = performance.now() - authStart

      results.latency = performance.now() - totalStart
      results.success = !dbError && !authError

      // パフォーマンス測定に記録
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
    }
  }> {
    console.log('🔍 Starting performance tests...')

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
      },
    }

    try {
      // 1. 接続テスト
      console.log('📡 Testing connection...')
      results.tests.connectionTest = await performanceSupabase.testConnection()

      // 2. シンプルクエリテスト
      console.log('📋 Testing simple query...')
      const simpleStart = performance.now()
      await performanceSupabase.getGameRoom('test')
      results.tests.simpleQuery = performance.now() - simpleStart

      // 3. 複雑クエリテスト
      console.log('🔍 Testing complex query...')
      const complexStart = performance.now()
      await performanceSupabase.getGameStatistics('test-player')
      results.tests.complexQuery = performance.now() - complexStart

      // 4. 更新操作テスト
      console.log('✏️ Testing update operation...')
      const updateStart = performance.now()
      await performanceSupabase.updatePlayerConnection('test-player', true)
      results.tests.updateOperation = performance.now() - updateStart

      // 5. リアルタイム遅延テスト（接続時間のみ測定）
      console.log('⚡ Testing realtime latency...')
      const realtimeStart = performance.now()
      const unsubscribe = performanceSupabase.subscribeToGameState(
        'test-game',
        () => {},
        () => {}
      )
      results.tests.realtimeLatency = performance.now() - realtimeStart
      unsubscribe()

      console.log('✅ Performance tests completed')
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
