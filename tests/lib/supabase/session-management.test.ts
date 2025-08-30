/**
 * セッション管理の修正に関するテスト
 * RLS無効化に伴うset_config関数呼び出しの削除を確認
 */

import { getPlayerSession, setPlayerSession } from '@/lib/supabase/client'

// LocalStorageのモック
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('Session Management - RLS修正対応', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('RPC呼び出しが削除されたことの確認', () => {
    test('setPlayerSessionが正常に動作する（RPC呼び出しなし）', async () => {
      const testPlayerId = 'rpc_test_player'

      // エラーが発生しないことを確認（以前はRPC呼び出しでエラーが発生）
      await expect(setPlayerSession(testPlayerId)).resolves.not.toThrow()

      // ローカルストレージには正しく保存される
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'napoleon_player_id',
        testPlayerId
      )
    })

    test('複数回のsetPlayerSession呼び出しでもエラーが発生しない', async () => {
      const playerIds = ['player_1', 'player_2', 'player_3', 'player_4']

      // 複数回呼び出し（以前はRPCエラーが発生）
      for (const playerId of playerIds) {
        await expect(setPlayerSession(playerId)).resolves.not.toThrow()
      }

      // すべての呼び出しが正常に完了 (secure storage 4 + legacy 1 per call)
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(20)
    })
  })

  describe('ローカルストレージベースのセッション管理', () => {
    test('setPlayerSessionがローカルストレージのみを使用する', async () => {
      const testPlayerId = 'localStorage_only_test'

      await setPlayerSession(testPlayerId)

      // ローカルストレージが使用されていることを確認
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'napoleon_player_id',
        testPlayerId
      )
    })

    test('getPlayerSessionがローカルストレージから値を取得する', () => {
      const expectedPlayerId = 'localStorage_get_test'
      localStorageMock.getItem.mockReturnValue(expectedPlayerId)

      const result = getPlayerSession()

      expect(localStorageMock.getItem).toHaveBeenCalledWith(
        'napoleon_player_id'
      )
      expect(result).toBe(expectedPlayerId)
    })
  })

  describe('開発環境での動作確認', () => {
    test('RLS無効化環境でのセッション管理が正常に動作する', async () => {
      const developmentPlayerId = 'dev_environment_player'

      // セッション設定
      await setPlayerSession(developmentPlayerId)

      // ローカルストレージから取得をモック
      localStorageMock.getItem.mockReturnValue(developmentPlayerId)

      // セッション取得
      const retrievedPlayerId = getPlayerSession()

      // 正常に設定・取得できることを確認
      expect(retrievedPlayerId).toBe(developmentPlayerId)
    })

    test('Quick Startゲームでのプレイヤーセッション設定', async () => {
      // Quick Start用の固定プレイヤーID
      const quickStartPlayerId = 'player_1'

      await setPlayerSession(quickStartPlayerId)

      // ローカルストレージに保存されていることを確認
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'napoleon_player_id',
        quickStartPlayerId
      )
    })
  })

  describe('将来のRLS有効化への対応', () => {
    test('コメントアウトされたRPC呼び出しコードが存在することを確認', () => {
      // setPlayerSession関数のソースコードを取得
      const setPlayerSessionSource = setPlayerSession.toString()

      // コメントアウトされたrpc呼び出しが含まれていることを確認
      // (実際の実装では、コメント内にset_configの呼び出しが含まれている)
      expect(setPlayerSessionSource).toContain('set_config')
      expect(setPlayerSessionSource).toContain('localStorage.setItem')
    })
  })

  describe('エラーが発生しなくなったことの確認', () => {
    test('404エラー（set_config関数が見つからない）が発生しない', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      const testPlayerId = 'no_error_test'

      // エラーが発生しないことを確認
      await expect(setPlayerSession(testPlayerId)).resolves.not.toThrow()

      // コンソールエラーが出力されていないことを確認
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('404')
      )
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('PGRST202')
      )

      consoleSpy.mockRestore()
      warnSpy.mockRestore()
    })

    test('PGRST202エラー（関数が見つからない）が発生しない', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const testPlayerId = 'pgrst202_test'

      await setPlayerSession(testPlayerId)

      // PGRST202エラーが出力されていないことを確認
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('PGRST202')
      )
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Could not find the function')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('パフォーマンス改善の確認', () => {
    test('RPC呼び出し削除によりsetPlayerSessionが高速化される', async () => {
      const startTime = Date.now()

      // 100回の呼び出しを実行
      const promises = Array.from({ length: 100 }, (_, i) =>
        setPlayerSession(`performance_test_${i}`)
      )

      await Promise.all(promises)

      const endTime = Date.now()
      const executionTime = endTime - startTime

      // RPC呼び出しがないため、非常に高速に完了することを確認
      // 100回の呼び出しが100ms以内に完了することを期待
      expect(executionTime).toBeLessThan(100)

      // ローカルストレージへの呼び出しが500回発生していることを確認 (secure storage 4 + legacy 1 per call = 5 per call)
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(500)
    })
  })
})
