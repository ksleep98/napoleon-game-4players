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

  // ゲームの初期化
  const initGame = useCallback(
    async (names: string[]) => {
      try {
        setLoading(true)
        setError(null)

        const newGame = initializeGame(names)
        setGameState(newGame)

        if (gameId) {
          await saveGameState(newGame)
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to initialize game'
        )
      } finally {
        setLoading(false)
      }
    },
    [gameId]
  )

  // ゲームの読み込み
  const loadGame = useCallback(async (id: string) => {
    try {
      setLoading(true)
      setError(null)

      const loadedGame = await loadGameState(id)
      if (loadedGame) {
        setGameState(loadedGame)
      } else {
        setError('Game not found')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game')
    } finally {
      setLoading(false)
    }
  }, [])

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
    if (gameId) {
      loadGame(gameId)
    } else if (playerNames && playerNames.length === 4) {
      initGame(playerNames)
    }
  }, [gameId, playerNames, loadGame, initGame])

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
