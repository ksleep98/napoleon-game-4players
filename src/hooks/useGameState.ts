'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  closeTrickResult,
  declareNapoleon,
  declareNapoleonWithDeclaration,
  exchangeCards,
  getCurrentPlayer,
  initializeAIGame,
  initializeGame,
  passNapoleonDeclaration,
  playCard,
  processAITurn,
  setAdjutant,
} from '@/lib/gameLogic'
import {
  loadGameState,
  saveGameState,
  subscribeToGameState,
} from '@/lib/supabase/secureGameService'
import type {
  Card as CardType,
  GameState,
  NapoleonDeclaration,
} from '@/types/game'

export function useGameState(
  gameId?: string,
  playerNames?: string[],
  isAI?: boolean
) {
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

        // AI モードかどうかで初期化方法を変える
        const newGame = isAI ? initializeAIGame('You') : initializeGame(names)

        // プレイヤーセッション設定（RLSポリシー用）
        // ゲーム状態から実際のプレイヤーIDを取得
        const playerId = newGame.players[0]?.id || 'player_1'
        try {
          const { setPlayerSession } = await import('@/lib/supabase/client')
          await setPlayerSession(playerId)
          console.log('Player session set to:', playerId)
        } catch (sessionError) {
          console.warn('Player session setup failed:', sessionError)
        }
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
    [gameId, loading, gameState, initialized, isAI]
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

        // AIモードの場合、次のプレイヤーがAIなら自動でプレイ
        if (isAI && updatedGame.phase === 'playing') {
          const currentPlayer = getCurrentPlayer(updatedGame)
          if (currentPlayer?.isAI) {
            // AI処理用に少し遅延を入れる
            setTimeout(async () => {
              try {
                const { processAIPlayingPhase } = await import(
                  '@/lib/ai/gameTricks'
                )
                const aiUpdatedGame = await processAIPlayingPhase(updatedGame)
                setGameState(aiUpdatedGame)

                if (gameId) {
                  await saveGameState(aiUpdatedGame)
                }
              } catch (aiError) {
                console.error('AI playing error:', aiError)
              }
            }, 1000)
          }
        }

        setGameState(updatedGame)

        if (gameId) {
          await saveGameState(updatedGame)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to play card')
      }
    },
    [gameState, gameId, isAI]
  )

  // ナポレオン宣言
  const handleSetNapoleon = useCallback(
    async (playerId: string, napoleonCard?: CardType) => {
      if (!gameState) return

      try {
        setError(null)

        const updatedGame = declareNapoleon(gameState, playerId, napoleonCard)
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

  // ナポレオン宣言（詳細版）
  const handleDeclareNapoleonWithDeclaration = useCallback(
    async (declaration: NapoleonDeclaration) => {
      if (!gameState) return

      try {
        setError(null)

        const updatedGame = declareNapoleonWithDeclaration(
          gameState,
          declaration
        )
        setGameState(updatedGame)

        if (gameId) {
          await saveGameState(updatedGame)
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to declare Napoleon'
        )
      }
    },
    [gameState, gameId]
  )

  // ナポレオンパス
  const handlePassNapoleon = useCallback(
    async (playerId: string) => {
      if (!gameState) return

      try {
        setError(null)

        const updatedGame = passNapoleonDeclaration(gameState, playerId)
        setGameState(updatedGame)

        if (gameId) {
          await saveGameState(updatedGame)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to pass Napoleon')
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

        if (gameId && process.env.NODE_ENV === 'production') {
          await saveGameState(updatedGame)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to set adjutant')
      }
    },
    [gameState, gameId]
  )

  // カード交換
  const handleExchangeCards = useCallback(
    async (playerId: string, cardsToDiscard: CardType[]) => {
      if (!gameState) return

      try {
        setError(null)

        const updatedGame = exchangeCards(gameState, playerId, cardsToDiscard)
        setGameState(updatedGame)

        if (gameId && process.env.NODE_ENV === 'production') {
          await saveGameState(updatedGame)
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to exchange cards'
        )
      }
    },
    [gameState, gameId]
  )

  // トリック結果を閉じる
  const handleClosePhaseResult = useCallback(async () => {
    if (!gameState) return

    try {
      setError(null)

      const updatedGame = closeTrickResult(gameState)
      setGameState(updatedGame)

      if (gameId && process.env.NODE_ENV === 'production') {
        await saveGameState(updatedGame)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to close trick result'
      )
    }
  }, [gameState, gameId])

  // プレイ可能なカードを取得
  const getPlayableCards = useCallback(
    (playerId: string): string[] => {
      if (!gameState || gameState.phase !== 'playing') return []

      const player = gameState.players.find((p) => p.id === playerId)
      if (!player) return []

      const currentPlayer = getCurrentPlayer(gameState)
      if (!currentPlayer || currentPlayer.id !== playerId) return []

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

    if (gameId && isAI) {
      // AI対戦モード: 新しいAIゲームを作成
      console.log('Creating new AI game:', gameId)
      initGame(['You']) // 人間プレイヤー名のみ渡す
    } else if (gameId && playerNames && playerNames.length === 4) {
      // Quick Start の場合: 新しいゲームを作成
      console.log('Creating new game for Quick Start:', gameId, playerNames)
      initGame(playerNames)
    } else if (gameId && !playerNames) {
      // 既存のゲームを読み込み
      console.log('Loading existing game:', gameId)
      loadGame(gameId)
    }
  }, [
    gameId,
    gameState,
    initGame,
    initialized,
    loadGame,
    loading,
    playerNames,
    isAI,
  ]) // 依存関係を最小限に

  // AI ターン処理
  useEffect(() => {
    if (!gameState || !isAI) return

    const processAI = async () => {
      try {
        // ナポレオンフェーズでは、次の宣言者がAIかチェック
        if (gameState.phase === 'napoleon') {
          const { getNextDeclarationPlayer } = await import(
            '@/lib/napoleonRules'
          )
          const nextPlayer = getNextDeclarationPlayer(gameState)
          if (!nextPlayer || !nextPlayer.isAI) {
            return
          }
        }

        if (
          gameState.phase === 'napoleon' ||
          gameState.phase === 'adjutant' ||
          gameState.phase === 'card_exchange'
        ) {
          const updatedState = await processAITurn(gameState)
          if (
            updatedState !== gameState &&
            JSON.stringify(updatedState) !== JSON.stringify(gameState)
          ) {
            setGameState(updatedState)
            // ローカル開発では保存をスキップ（データベース制約エラー回避）
            if (gameId && process.env.NODE_ENV === 'production') {
              try {
                await saveGameState(updatedState)
              } catch (saveError) {
                console.error(
                  'Failed to save game state, but continuing:',
                  saveError
                )
              }
            }
          }
        } else if (gameState.phase === 'playing') {
          // トリック結果表示中の場合は、ユーザーがモーダルを閉じるまで待機
          if (gameState.showingTrickResult) {
            return // AIの自動進行を停止し、ユーザーの操作を待つ
          }

          // プレイングフェーズでAIのターン処理
          const currentPlayer = getCurrentPlayer(gameState)
          if (currentPlayer?.isAI) {
            const { processAIPlayingPhase } = await import(
              '@/lib/ai/gameTricks'
            )
            const updatedState = await processAIPlayingPhase(gameState)
            if (
              updatedState !== gameState &&
              JSON.stringify(updatedState) !== JSON.stringify(gameState)
            ) {
              setGameState(updatedState)
              if (gameId && process.env.NODE_ENV === 'production') {
                try {
                  await saveGameState(updatedState)
                } catch (saveError) {
                  console.error('Failed to save AI playing state:', saveError)
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('AI processing error:', error)
        // エラーが発生してもループを停止しない
      }
    }

    // 少し遅延を入れてAIの動作を見せる
    const timer = setTimeout(processAI, 1500) // 少し長めに設定
    return () => clearTimeout(timer)
  }, [gameState, isAI, gameId])

  return {
    gameState,
    loading,
    error,
    actions: {
      initGame,
      loadGame,
      playCard: handlePlayCard,
      setNapoleon: handleSetNapoleon,
      declareNapoleonWithDeclaration: handleDeclareNapoleonWithDeclaration,
      passNapoleon: handlePassNapoleon,
      setAdjutant: handleSetAdjutant,
      exchangeCards: handleExchangeCards,
      closeTrickResult: handleClosePhaseResult,
    },
    utils: {
      getPlayableCards,
      getCurrentPlayer: () => (gameState ? getCurrentPlayer(gameState) : null),
    },
  }
}
