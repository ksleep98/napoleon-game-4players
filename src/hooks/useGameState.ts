'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getCurrentPlayer,
  initializeGame,
  playCard,
  setAdjutant,
  setNapoleon,
} from '@/lib/gameLogic'
import {
  loadGameState,
  saveGameState,
  subscribeToGameState,
} from '@/lib/supabase/gameService'
import type { Card as CardType, GameState } from '@/types/game'

export function useGameState(gameId?: string, playerNames?: string[]) {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false) // 初期化完了フラグ

  // ゲームの初期化
  const initGame = useCallback(
    async (names: string[]) => {
      if (loading || gameState || initialized) return // 既に処理中または完了済みの場合は何もしない

      try {
        setLoading(true)
        setError(null)
        setInitialized(true)

        // プレイヤーセッション設定（RLSポリシー用）
        const playerId = 'player_1' // Quick Start用の固定プレイヤーID
        try {
          const { setPlayerSession } = await import('@/lib/supabase/client')
          await setPlayerSession(playerId)
        } catch (sessionError) {
          console.warn('Player session setup failed:', sessionError)
        }

        const newGame = initializeGame(names)
        // gameIdが指定されている場合は設定
        if (gameId) {
          newGame.id = gameId
        }
        setGameState(newGame)

        if (gameId) {
          await saveGameState(newGame)
        }

        console.log('Game initialized successfully:', newGame.id)
      } catch (err) {
        console.error('Failed to initialize game:', err)
        setError(
          err instanceof Error ? err.message : 'Failed to initialize game'
        )
        setInitialized(false) // エラーの場合は再試行可能にする
      } finally {
        setLoading(false)
      }
    },
    [gameId, loading, gameState, initialized]
  )

  // ゲームの読み込み
  const loadGame = useCallback(
    async (id: string) => {
      if (loading || gameState || initialized) return // 既に処理中または完了済みの場合は何もしない

      try {
        setLoading(true)
        setError(null)
        setInitialized(true)

        const loadedGame = await loadGameState(id)
        if (loadedGame) {
          setGameState(loadedGame)
          console.log('Game loaded successfully:', id)
        } else {
          setError('Game not found')
          setInitialized(false)
        }
      } catch (err) {
        console.error('Failed to load game:', err)
        setError(err instanceof Error ? err.message : 'Failed to load game')
        setInitialized(false)
      } finally {
        setLoading(false)
      }
    },
    [loading, gameState, initialized]
  )

  // カードをプレイ
  const handlePlayCard = useCallback(
    async (playerId: string, cardId: string) => {
      if (!gameState) return

      try {
        setError(null)

        const updatedGame = playCard(gameState, playerId, cardId)
        setGameState(updatedGame)

        if (gameId) {
          await saveGameState(updatedGame)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to play card')
      }
    },
    [gameState, gameId]
  )

  // ナポレオン宣言
  const handleSetNapoleon = useCallback(
    async (playerId: string, napoleonCard?: CardType) => {
      if (!gameState) return

      try {
        setError(null)

        const updatedGame = setNapoleon(gameState, playerId, napoleonCard)
        setGameState(updatedGame)

        if (gameId) {
          await saveGameState(updatedGame)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to set Napoleon')
      }
    },
    [gameState, gameId]
  )

  // 副官設定
  const handleSetAdjutant = useCallback(
    async (adjutantCard: CardType) => {
      if (!gameState) return

      try {
        setError(null)

        const updatedGame = setAdjutant(gameState, adjutantCard)
        setGameState(updatedGame)

        if (gameId) {
          await saveGameState(updatedGame)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to set adjutant')
      }
    },
    [gameState, gameId]
  )

  // プレイ可能なカードを取得
  const getPlayableCards = useCallback(
    (playerId: string): string[] => {
      if (!gameState || gameState.phase !== 'playing') return []

      const player = gameState.players.find((p) => p.id === playerId)
      if (!player) return []

      const currentPlayer = getCurrentPlayer(gameState)
      if (currentPlayer.id !== playerId) return []

      // フォロー義務をチェック
      if (gameState.leadingSuit) {
        const suitCards = player.hand.filter(
          (card) => card.suit === gameState.leadingSuit
        )
        if (suitCards.length > 0) {
          // リードスートを持っている場合はそれしか出せない
          return suitCards.map((card) => card.id)
        }
      }

      // フォローできない場合は全てのカードがプレイ可能
      return player.hand.map((card) => card.id)
    },
    [gameState]
  )

  // ゲーム状態の監視（リアルタイム）
  useEffect(() => {
    if (!gameId) return

    const unsubscribe = subscribeToGameState(gameId, (updatedState) => {
      setGameState(updatedState)
    })

    return unsubscribe
  }, [gameId])

  // 初期化処理
  useEffect(() => {
    if (gameState || loading || initialized) return // 既に処理済みの場合は何もしない

    if (gameId && playerNames && playerNames.length === 4) {
      // Quick Start の場合: 新しいゲームを作成
      console.log('Creating new game for Quick Start:', gameId, playerNames)
      initGame(playerNames)
    } else if (gameId && !playerNames) {
      // 既存のゲームを読み込み
      console.log('Loading existing game:', gameId)
      loadGame(gameId)
    }
  }, [gameId, gameState, initGame, initialized, loadGame, loading, playerNames]) // 依存関係を最小限に

  return {
    gameState,
    loading,
    error,
    actions: {
      initGame,
      loadGame,
      playCard: handlePlayCard,
      setNapoleon: handleSetNapoleon,
      setAdjutant: handleSetAdjutant,
    },
    utils: {
      getPlayableCards,
      getCurrentPlayer: () => (gameState ? getCurrentPlayer(gameState) : null),
    },
  }
}
