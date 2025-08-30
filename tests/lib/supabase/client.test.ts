import { getPlayerSession, setPlayerSession } from '@/lib/supabase/client'

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

describe('Supabase Client Functions', () => {
  beforeEach(() => {
    // 各テストの前にモックをクリア
    jest.clearAllMocks()
  })

  describe('setPlayerSession', () => {
    test('プレイヤーIDをローカルストレージに正常に保存する', async () => {
      const testPlayerId = 'player_123'

      await setPlayerSession(testPlayerId)

      // レガシーサポートのための従来の保存も確認
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'napoleon_player_id',
        testPlayerId
      )
      // セキュアストレージでは複数のアイテムが保存されるため、呼び出し回数が多くなる
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(5) // secure storage (4) + legacy (1)
    })

    test('空文字のプレイヤーIDでも正常に処理される', async () => {
      const testPlayerId = ''

      await setPlayerSession(testPlayerId)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'napoleon_player_id',
        testPlayerId
      )
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(5) // secure storage (4) + legacy (1)
    })

    test('特殊文字を含むプレイヤーIDでも正常に処理される', async () => {
      const testPlayerId = 'player_特殊文字@#$%^&*()'

      await setPlayerSession(testPlayerId)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'napoleon_player_id',
        testPlayerId
      )
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(5) // secure storage (4) + legacy (1)
    })

    test('長いプレイヤーIDでも正常に処理される', async () => {
      const testPlayerId = 'a'.repeat(1000) // 1000文字の長い文字列

      await setPlayerSession(testPlayerId)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'napoleon_player_id',
        testPlayerId
      )
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(5) // secure storage (4) + legacy (1)
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

  describe('getPlayerSession', () => {
    test('ローカルストレージからプレイヤーIDを正常に取得する', () => {
      const expectedPlayerId = 'player_456'
      localStorageMock.getItem.mockReturnValue(expectedPlayerId)

      const result = getPlayerSession()

      expect(localStorageMock.getItem).toHaveBeenCalledWith(
        'napoleon_player_id'
      )
      expect(result).toBe(expectedPlayerId)
    })

    test('ローカルストレージにプレイヤーIDが存在しない場合nullを返す', () => {
      localStorageMock.getItem.mockReturnValue(null)

      const result = getPlayerSession()

      expect(localStorageMock.getItem).toHaveBeenCalledWith(
        'napoleon_player_id'
      )
      expect(result).toBeNull()
    })

    test('windowオブジェクトが存在しない環境（SSR）でnullを返す', () => {
      // typeof windowをモックしてSSR環境をシミュレート
      const originalWindow = global.window
      // @ts-expect-error - テスト用のmock
      delete global.window

      const result = getPlayerSession()

      expect(result).toBeNull()

      // windowを復元
      global.window = originalWindow
    })
  })

  describe('setPlayerSession と getPlayerSession の統合テスト', () => {
    test('保存したプレイヤーIDを正確に取得できる', async () => {
      const testPlayerId = 'integration_test_player'

      // プレイヤーIDを保存
      await setPlayerSession(testPlayerId)

      // getPlayerSessionが同じ値を取得することをモック
      localStorageMock.getItem.mockReturnValue(testPlayerId)

      const retrievedPlayerId = getPlayerSession()

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'napoleon_player_id',
        testPlayerId
      )
      expect(localStorageMock.getItem).toHaveBeenCalledWith(
        'napoleon_player_id'
      )
      expect(retrievedPlayerId).toBe(testPlayerId)
    })

    test('複数回のセッション設定で最後の値が正しく保存される', async () => {
      const playerId1 = 'player_1'
      const playerId2 = 'player_2'
      const playerId3 = 'player_3'

      // 複数回設定
      await setPlayerSession(playerId1)
      await setPlayerSession(playerId2)
      await setPlayerSession(playerId3)

      // 3回 * 5コール（secure storage 4 + legacy 1）= 15回呼ばれていることを確認
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(15)

      // 最後の呼び出しが正しいことを確認
      expect(localStorageMock.setItem).toHaveBeenLastCalledWith(
        'napoleon_player_id',
        playerId3
      )
    })
  })

  describe('パフォーマンステスト', () => {
    test('大量のsetPlayerSession呼び出しが適切な時間内で完了する', async () => {
      const startTime = Date.now()
      const iterations = 1000

      // 1000回の呼び出し
      const promises = Array.from({ length: iterations }, (_, i) =>
        setPlayerSession(`player_${i}`)
      )

      await Promise.all(promises)

      const endTime = Date.now()
      const executionTime = endTime - startTime

      // 1000回の呼び出しが1秒以内に完了することを確認
      expect(executionTime).toBeLessThan(1000)
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(iterations * 5) // secure storage (4) + legacy (1) per call
    })
  })

  describe('エラーハンドリング', () => {
    test('localStorageのsetItemでエラーが発生した場合のエラーハンドリング', async () => {
      // localStorageのsetItemでエラーを発生させる
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })

      const testPlayerId = 'error_test_player'

      // 現在の実装ではエラーが传播するので、rejectされることを確認
      await expect(setPlayerSession(testPlayerId)).rejects.toThrow(
        'Storage quota exceeded'
      )
    })

    test('localStorageのgetItemでエラーが発生した場合のエラーハンドリング', () => {
      // localStorageのgetItemでエラーを発生させる
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage is not available')
      })

      // 現在の実装ではエラーをキャッチしてnullを返すので、nullが返されることを確認
      const result = getPlayerSession()
      expect(result).toBeNull()
    })
  })
})
