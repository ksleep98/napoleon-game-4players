/**
 * 実際のsetPlayerSession/getPlayerSession関数のテスト
 * モックを使わずに実際の関数の動作をテスト
 */

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
  writable: true,
})

// 実際の関数をimport
import { getPlayerSession, setPlayerSession } from '@/lib/supabase/client'

describe('Supabase Client Functions - 実関数テスト', () => {
  beforeEach(() => {
    // 各テストの前にモックをクリア
    jest.clearAllMocks()
  })

  describe('setPlayerSession - 実際の関数', () => {
    test('プレイヤーIDをローカルストレージに正常に保存する', async () => {
      const testPlayerId = 'player_123'

      await setPlayerSession(testPlayerId)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'napoleon_player_id',
        testPlayerId
      )
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

    test('Quick Startで使用される固定プレイヤーID', async () => {
      const quickStartPlayerId = 'player_1'

      await setPlayerSession(quickStartPlayerId)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'napoleon_player_id',
        quickStartPlayerId
      )
    })
  })

  describe('getPlayerSession - 実際の関数', () => {
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
  })

  describe('RLS無効化に伴う変更の確認', () => {
    test('setPlayerSessionが同期的にローカルストレージのみを更新', async () => {
      const testPlayerId = 'rls_disabled_test'
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {})

      await setPlayerSession(testPlayerId)

      // ローカルストレージが更新されている
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'napoleon_player_id',
        testPlayerId
      )

      // コンソールに警告が出力されていない（RPC呼び出しエラーがない）
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Failed to set player session')
      )

      consoleSpy.mockRestore()
    })

    test('404エラーやPGRST202エラーが発生しない', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      const testPlayerId = 'no_error_test'

      await setPlayerSession(testPlayerId)

      // 404エラーが発生していない
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('404')
      )

      // PGRST202エラーが発生していない
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('PGRST202')
      )

      consoleSpy.mockRestore()
      warnSpy.mockRestore()
    })
  })

  describe('統合テスト', () => {
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

    test('複数プレイヤーでのセッション管理', async () => {
      const playerIds = ['player_1', 'player_2', 'player_3', 'player_4']

      // Quick Start用の4人のプレイヤーIDを順番に設定
      for (const playerId of playerIds) {
        await setPlayerSession(playerId)
      }

      // 4回の設定が呼ばれている (各呼び出しで5回ずつ = 20回)
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(20)

      // 最後に設定したプレイヤーIDが保存されている
      expect(localStorageMock.setItem).toHaveBeenLastCalledWith(
        'napoleon_player_id',
        'player_4'
      )
    })
  })

  describe('パフォーマンステスト', () => {
    test('setPlayerSessionが高速に実行される（RPC削除による改善）', async () => {
      const startTime = Date.now()
      const iterations = 100

      // 100回の呼び出し
      const promises = Array.from({ length: iterations }, (_, i) =>
        setPlayerSession(`player_${i}`)
      )

      await Promise.all(promises)

      const endTime = Date.now()
      const executionTime = endTime - startTime

      // RPC呼び出しがないため、非常に高速に完了することを確認
      expect(executionTime).toBeLessThan(50) // 50ms以内
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(iterations * 5) // secure storage (4) + legacy (1) per call
    })
  })
})
