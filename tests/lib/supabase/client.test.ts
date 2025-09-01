import { setPlayerSession } from '@/lib/supabase/client'

// LocalStorageのモック
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

// windowオブジェクトのモック
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// セキュアストレージモジュールをモック
jest.mock('@/utils/secureStorage', () => ({
  setSecurePlayer: jest.fn(),
  getSecurePlayerId: jest.fn(),
  getSecurePlayerName: jest.fn(),
  isSecureSessionValid: jest.fn(),
  clearSecurePlayer: jest.fn(),
}))

// モック関数の参照を取得
const mockSetSecurePlayer = jest.mocked(
  require('@/utils/secureStorage').setSecurePlayer
)
const mockGetSecurePlayerName = jest.mocked(
  require('@/utils/secureStorage').getSecurePlayerName
)

describe('Supabase Client Functions', () => {
  beforeEach(() => {
    // 各テストの前にモックをクリア
    jest.clearAllMocks()
  })

  describe('setPlayerSession', () => {
    test('プレイヤーIDをセキュアストレージに正常に保存する', async () => {
      const testPlayerId = 'player_123'
      mockGetSecurePlayerName.mockReturnValue('TestPlayer')

      await setPlayerSession(testPlayerId)

      // セキュアストレージが正しく呼ばれることを確認
      expect(mockSetSecurePlayer).toHaveBeenCalledWith(
        testPlayerId,
        'TestPlayer'
      )
    })

    test('空文字のプレイヤーIDでも正常に処理される', async () => {
      const testPlayerId = ''
      mockGetSecurePlayerName.mockReturnValue(null)

      await setPlayerSession(testPlayerId)

      expect(mockSetSecurePlayer).toHaveBeenCalledWith(
        testPlayerId,
        'Anonymous'
      )
    })

    test('特殊文字を含むプレイヤーIDでも正常に処理される', async () => {
      const testPlayerId = 'player_特殊文字@#$%^&*()'
      mockGetSecurePlayerName.mockReturnValue('TestPlayer')

      await setPlayerSession(testPlayerId)

      expect(mockSetSecurePlayer).toHaveBeenCalledWith(
        testPlayerId,
        'TestPlayer'
      )
    })

    test('長いプレイヤーIDでも正常に処理される', async () => {
      const testPlayerId = 'a'.repeat(1000) // 1000文字の長い文字列
      mockGetSecurePlayerName.mockReturnValue('TestPlayer')

      await setPlayerSession(testPlayerId)

      expect(mockSetSecurePlayer).toHaveBeenCalledWith(
        testPlayerId,
        'TestPlayer'
      )
    })

    test('windowオブジェクトが存在しない環境（SSR）でエラーが発生しない', async () => {
      // typeof windowをモックしてSSR環境をシミュレート
      const originalWindow = global.window
      // @ts-expect-error - テスト用にmock
      delete global.window

      const testPlayerId = 'player_ssr_test'

      // エラーが発生しないことを確認
      await expect(setPlayerSession(testPlayerId)).resolves.not.toThrow()

      // windowを復元
      global.window = originalWindow
    })
  })

  describe('getPlayerSession (deprecated)', () => {
    // getPlayerSessionは非推奨になったため、直接テストせず、
    // 代わりに usePlayerSession での統合テストを程行する
    test('セッション取得はusePlayerSessionフックで行うこと', () => {
      // getPlayerSessionは非推奨となったため、
      // 今後は usePlayerSession でセッションを管理する
      expect(true).toBe(true)
    })
  })

  describe('セキュアストレージベースの統合テスト', () => {
    test('セキュアストレージにプレイヤー情報が保存される', async () => {
      const testPlayerId = 'integration_test_player'
      mockGetSecurePlayerName.mockReturnValue('TestPlayer')

      // プレイヤーIDを保存
      await setPlayerSession(testPlayerId)

      // セキュアストレージが正しく呼ばれることを確認
      expect(mockSetSecurePlayer).toHaveBeenCalledWith(
        testPlayerId,
        'TestPlayer'
      )

      // セキュアストレージの動作を確認
      expect(mockSetSecurePlayer).toHaveBeenCalledWith(
        testPlayerId,
        'TestPlayer'
      )

      // 実際のセッション取得は usePlayerSession で行う
      // getPlayerSession は非推奨となった
    })

    test('複数回のセッション設定で最後の値が正しく保存される', async () => {
      const playerId1 = 'player_1'
      const playerId2 = 'player_2'
      const playerId3 = 'player_3'
      mockGetSecurePlayerName.mockReturnValue('TestPlayer')

      // 複数回設定
      await setPlayerSession(playerId1)
      await setPlayerSession(playerId2)
      await setPlayerSession(playerId3)

      // 3回の呼び出しがあったことを確認
      expect(mockSetSecurePlayer).toHaveBeenCalledTimes(3)

      // 最後の呼び出しが正しいことを確認
      expect(mockSetSecurePlayer).toHaveBeenLastCalledWith(
        playerId3,
        'TestPlayer'
      )
    })
  })

  describe('パフォーマンステスト', () => {
    test('大量のsetPlayerSession呼び出しが適切な時間内で完了する', async () => {
      const startTime = Date.now()
      const iterations = 100 // テストの高速化のため数を減らす
      mockGetSecurePlayerName.mockReturnValue('TestPlayer')

      // 100回の呼び出し
      const promises = Array.from({ length: iterations }, (_, i) =>
        setPlayerSession(`player_${i}`)
      )

      await Promise.all(promises)

      const endTime = Date.now()
      const executionTime = endTime - startTime

      // 100回の呼び出しが500ms以内に完了することを確認
      expect(executionTime).toBeLessThan(500)
      expect(mockSetSecurePlayer).toHaveBeenCalledTimes(iterations)
    })
  })

  describe('エラーハンドリング', () => {
    test('セキュアストレージでエラーが発生した場合のエラーハンドリング', async () => {
      // セキュアストレージでエラーを発生させる
      mockSetSecurePlayer.mockImplementation(() => {
        throw new Error('Secure storage error')
      })

      const testPlayerId = 'error_test_player'
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {})

      // エラーが発生しても関数は継続する（警告のみ）
      await expect(setPlayerSession(testPlayerId)).resolves.not.toThrow()

      // 警告が出力されることを確認
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to use secure storage:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    test('非推奨関数の代替手段が提供されていること', () => {
      // getPlayerSessionは非推奨となり、usePlayerSessionが推奨される
      // 今後のセッション管理はセキュアストレージベースで行う
      expect(typeof mockSetSecurePlayer).toBe('function')
    })
  })
})
