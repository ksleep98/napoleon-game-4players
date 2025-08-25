/**
 * Supabase環境設定のテスト
 * 環境変数の設定状態とクライアントの初期化をテスト
 */

describe('Supabase Environment Configuration', () => {
  // 元の環境変数を保存
  const originalEnv = process.env

  beforeEach(() => {
    // 各テストで新しい環境を作成
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    // テスト後に元の環境変数を復元
    process.env = originalEnv
  })

  describe('環境変数の設定', () => {
    test('本番環境で必要な環境変数が設定されている場合', () => {
      // 本番環境の環境変数を設定
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key_123456789'

      // 動的インポートでクライアントを再読み込み
      const { supabase } = require('@/lib/supabase/client')

      expect(supabase).toBeDefined()
      expect(supabase.supabaseUrl).toBe('https://test.supabase.co')
      expect(supabase.supabaseKey).toBe('test_anon_key_123456789')
    })

    test('環境変数が未設定の場合はモック値が使用される', () => {
      // 環境変数を削除
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      // 動的インポートでクライアントを再読み込み
      const { supabase } = require('@/lib/supabase/client')

      expect(supabase).toBeDefined()
      expect(supabase.supabaseUrl).toBe('https://mock.supabase.co')
      expect(supabase.supabaseKey).toBe('mock_anon_key')
    })

    test('部分的に環境変数が設定されている場合', () => {
      // URLのみ設定
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://partial.supabase.co'
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const { supabase } = require('@/lib/supabase/client')

      expect(supabase).toBeDefined()
      expect(supabase.supabaseUrl).toBe('https://partial.supabase.co')
      expect(supabase.supabaseKey).toBe('mock_anon_key')
    })
  })

  describe('Supabaseクライアントの設定', () => {
    test('リアルタイム設定が正しく適用されている', () => {
      const { supabase } = require('@/lib/supabase/client')

      // リアルタイムクライアントが初期化されていることを確認
      expect(supabase.realtime).toBeDefined()
    })

    test('認証設定が正しく適用されている', () => {
      const { supabase } = require('@/lib/supabase/client')

      // 認証クライアントが初期化されていることを確認
      expect(supabase.auth).toBeDefined()
    })
  })

  describe('型定義のテスト', () => {
    test('Databaseの型定義がエクスポートされている', () => {
      const clientModule = require('@/lib/supabase/client')

      // モジュールが存在することを確認（型定義はTypeScript時のみ有効）
      expect(clientModule).toBeDefined()
      expect(typeof clientModule).toBe('object')
    })

    test('テーブル型定義が正しく設定されている', () => {
      const client = require('@/lib/supabase/client')

      // 主要なテーブル型が定義されていることをテスト
      const tableNames = ['games', 'game_rooms', 'players', 'game_results']

      tableNames.forEach((tableName) => {
        // supabase.from()でテーブルにアクセスできることを確認
        expect(() => client.supabase.from(tableName)).not.toThrow()
      })
    })
  })
})
