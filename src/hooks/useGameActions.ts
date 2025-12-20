'use client'

import { useCallback, useTransition } from 'react'
import {
  initializeAIGameAction,
  initializeGameAction,
} from '@/app/actions/gameInitActions'
import {
  closeTrickResultAction,
  declareNapoleonAction,
  exchangeCardsAction,
  passNapoleonAction,
  playCardAction,
  redealCardsAction,
  setAdjutantAction,
} from '@/app/actions/gameLogicActions'
import { ACTION_TYPES } from '@/lib/constants'
import { setPlayerSession } from '@/lib/supabase/client'
import { loadGameState } from '@/lib/supabase/secureGameService'
import type {
  Card,
  GameAction,
  GameContextState,
  NapoleonDeclaration,
} from '@/types/game'

interface UseGameActionsProps {
  state: GameContextState
  dispatch: (action: GameAction) => void
  gameId?: string
  isAI?: boolean
}

export function useGameActions({
  state,
  dispatch,
  gameId,
  isAI,
}: UseGameActionsProps) {
  const [isPending, startTransition] = useTransition()

  const initGame = useCallback(
    (names: string[]) => {
      if (state.loading || state.gameState || state.initialized) return

      startTransition(async () => {
        try {
          dispatch({
            type: ACTION_TYPES.GAME.SET_LOADING,
            payload: { loading: true },
          })
          dispatch({ type: ACTION_TYPES.GAME.RESET_ERROR })
          dispatch({
            type: ACTION_TYPES.GAME.SET_INITIALIZED,
            payload: { initialized: true },
          })

          // Server Action経由でセキュアなゲーム初期化
          // 一意のプレイヤーIDを生成（実際のセッション管理で使用）
          const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

          let result: Awaited<
            ReturnType<
              typeof initializeGameAction | typeof initializeAIGameAction
            >
          >

          if (isAI) {
            // AIゲーム初期化（Server Action）
            result = await initializeAIGameAction('You', playerId)
          } else {
            // マルチプレイヤーゲーム初期化（Server Action）
            result = await initializeGameAction(names, playerId)
          }

          if (result.success && result.data) {
            const { gameState, gameId: newGameId } = result.data

            dispatch({
              type: ACTION_TYPES.GAME.SET_GAME_STATE,
              payload: { gameState },
            })

            // プレイヤーセッション設定
            try {
              const actualPlayerId = gameState.players[0]?.id || playerId
              await setPlayerSession(actualPlayerId)
            } catch (sessionError) {
              console.warn('Player session setup failed:', sessionError)
            }
          } else {
            throw new Error(result.error || 'Failed to initialize game')
          }
        } catch (err) {
          console.error('Failed to initialize game:', err)
          dispatch({
            type: ACTION_TYPES.GAME.SET_ERROR,
            payload: {
              error:
                err instanceof Error
                  ? err.message
                  : 'Failed to initialize game',
            },
          })
          dispatch({
            type: ACTION_TYPES.GAME.SET_INITIALIZED,
            payload: { initialized: false },
          })
        }
      })
    },
    [state.loading, state.gameState, state.initialized, isAI, dispatch]
  )

  const loadGame = useCallback(
    (id: string) => {
      if (state.loading || state.gameState || state.initialized) return

      startTransition(async () => {
        try {
          dispatch({
            type: ACTION_TYPES.GAME.SET_LOADING,
            payload: { loading: true },
          })
          dispatch({ type: ACTION_TYPES.GAME.RESET_ERROR })
          dispatch({
            type: ACTION_TYPES.GAME.SET_INITIALIZED,
            payload: { initialized: true },
          })

          const loadedGame = await loadGameState(id)
          if (loadedGame) {
            dispatch({
              type: ACTION_TYPES.GAME.SET_GAME_STATE,
              payload: { gameState: loadedGame },
            })
          } else {
            dispatch({
              type: ACTION_TYPES.GAME.SET_ERROR,
              payload: { error: 'Game not found' },
            })
            dispatch({
              type: ACTION_TYPES.GAME.SET_INITIALIZED,
              payload: { initialized: false },
            })
          }
        } catch (err) {
          console.error('Failed to load game:', err)
          dispatch({
            type: ACTION_TYPES.GAME.SET_ERROR,
            payload: {
              error: err instanceof Error ? err.message : 'Failed to load game',
            },
          })
          dispatch({
            type: ACTION_TYPES.GAME.SET_INITIALIZED,
            payload: { initialized: false },
          })
        }
      })
    },
    [state.loading, state.gameState, state.initialized, dispatch]
  )

  const handlePlayCard = useCallback(
    (playerId: string, cardId: string) => {
      if (!state.gameState || !gameId) return

      startTransition(async () => {
        try {
          dispatch({ type: ACTION_TYPES.GAME.RESET_ERROR })

          // Server Action経由でカードプレイ
          const result = await playCardAction(gameId, playerId, cardId)

          if (result.success && result.data) {
            dispatch({
              type: ACTION_TYPES.GAME.SET_GAME_STATE,
              payload: { gameState: result.data },
            })
          } else {
            throw new Error(result.error || 'Failed to play card')
          }
        } catch (err) {
          console.error('Failed to play card:', err)
          dispatch({
            type: ACTION_TYPES.GAME.SET_ERROR,
            payload: {
              error: err instanceof Error ? err.message : 'Failed to play card',
            },
          })
        }
      })
    },
    [state.gameState, gameId, dispatch]
  )

  const handleDeclareNapoleon = useCallback(
    (declaration: NapoleonDeclaration) => {
      if (!state.gameState || !gameId) return

      const currentPlayerId =
        state.gameState.players[state.gameState.currentPlayerIndex]?.id
      if (!currentPlayerId) return

      startTransition(async () => {
        try {
          dispatch({ type: ACTION_TYPES.GAME.RESET_ERROR })

          // Server Action経由でナポレオン宣言
          const result = await declareNapoleonAction(
            gameId,
            currentPlayerId,
            declaration
          )

          if (result.success && result.data) {
            dispatch({
              type: ACTION_TYPES.GAME.SET_GAME_STATE,
              payload: { gameState: result.data },
            })
          } else {
            throw new Error(result.error || 'Failed to declare Napoleon')
          }
        } catch (err) {
          console.error('Failed to declare Napoleon:', err)
          dispatch({
            type: ACTION_TYPES.GAME.SET_ERROR,
            payload: {
              error:
                err instanceof Error
                  ? err.message
                  : 'Failed to declare Napoleon',
            },
          })
        }
      })
    },
    [state.gameState, gameId, dispatch]
  )

  const handlePassNapoleon = useCallback(
    (playerId: string) => {
      if (!state.gameState || !gameId) return

      startTransition(async () => {
        try {
          dispatch({ type: ACTION_TYPES.GAME.RESET_ERROR })

          // Server Action経由でナポレオンパス
          const result = await passNapoleonAction(gameId, playerId)

          if (result.success && result.data) {
            dispatch({
              type: ACTION_TYPES.GAME.SET_GAME_STATE,
              payload: { gameState: result.data },
            })
          } else {
            throw new Error(result.error || 'Failed to pass Napoleon')
          }
        } catch (err) {
          console.error('Failed to pass Napoleon:', err)
          dispatch({
            type: ACTION_TYPES.GAME.SET_ERROR,
            payload: {
              error:
                err instanceof Error ? err.message : 'Failed to pass Napoleon',
            },
          })
        }
      })
    },
    [state.gameState, gameId, dispatch]
  )

  const handleSetAdjutant = useCallback(
    (adjutantCard: Card) => {
      if (!state.gameState || !gameId) return

      const napoleonPlayerId = state.gameState.napoleonDeclaration?.playerId
      if (!napoleonPlayerId) return

      startTransition(async () => {
        try {
          dispatch({ type: ACTION_TYPES.GAME.RESET_ERROR })

          // Server Action経由で副官設定
          const result = await setAdjutantAction(
            gameId,
            napoleonPlayerId,
            adjutantCard
          )

          if (result.success && result.data) {
            dispatch({
              type: ACTION_TYPES.GAME.SET_GAME_STATE,
              payload: { gameState: result.data },
            })
          } else {
            throw new Error(result.error || 'Failed to set adjutant')
          }
        } catch (err) {
          console.error('Failed to set adjutant:', err)
          dispatch({
            type: ACTION_TYPES.GAME.SET_ERROR,
            payload: {
              error:
                err instanceof Error ? err.message : 'Failed to set adjutant',
            },
          })
        }
      })
    },
    [state.gameState, gameId, dispatch]
  )

  const handleExchangeCards = useCallback(
    (playerId: string, cardsToDiscard: Card[]) => {
      if (!state.gameState || !gameId) return

      startTransition(async () => {
        try {
          dispatch({ type: ACTION_TYPES.GAME.RESET_ERROR })

          // Server Action経由でカード交換
          const result = await exchangeCardsAction(
            gameId,
            playerId,
            cardsToDiscard
          )

          if (result.success && result.data) {
            dispatch({
              type: ACTION_TYPES.GAME.SET_GAME_STATE,
              payload: { gameState: result.data },
            })
          } else {
            throw new Error(result.error || 'Failed to exchange cards')
          }
        } catch (err) {
          console.error('Failed to exchange cards:', err)
          dispatch({
            type: ACTION_TYPES.GAME.SET_ERROR,
            payload: {
              error:
                err instanceof Error ? err.message : 'Failed to exchange cards',
            },
          })
        }
      })
    },
    [state.gameState, gameId, dispatch]
  )

  const handleCloseTrickResult = useCallback(() => {
    if (!state.gameState || !gameId) return

    const currentPlayerId = state.gameState.players[0]?.id // 任意のプレイヤーID（UIアクション）
    if (!currentPlayerId) return

    startTransition(async () => {
      try {
        dispatch({ type: ACTION_TYPES.GAME.RESET_ERROR })

        // Server Action経由でトリック結果を閉じる
        const result = await closeTrickResultAction(gameId, currentPlayerId)

        if (result.success && result.data) {
          dispatch({
            type: ACTION_TYPES.GAME.SET_GAME_STATE,
            payload: { gameState: result.data },
          })
        } else {
          throw new Error(result.error || 'Failed to close trick result')
        }
      } catch (err) {
        console.error('Failed to close trick result:', err)
        dispatch({
          type: ACTION_TYPES.GAME.SET_ERROR,
          payload: {
            error:
              err instanceof Error
                ? err.message
                : 'Failed to close trick result',
          },
        })
      }
    })
  }, [state.gameState, gameId, dispatch])

  const handleRedealCards = useCallback(() => {
    if (!state.gameState || !gameId) return

    const currentPlayerId = state.gameState.players[0]?.id // 任意のプレイヤーID
    if (!currentPlayerId) return

    startTransition(async () => {
      try {
        dispatch({ type: ACTION_TYPES.GAME.RESET_ERROR })

        // Server Action経由で配り直し
        const result = await redealCardsAction(gameId, currentPlayerId)

        if (result.success && result.data) {
          dispatch({
            type: ACTION_TYPES.GAME.SET_GAME_STATE,
            payload: { gameState: result.data },
          })
          console.log('Cards redealt - new game started')
        } else {
          throw new Error(result.error || 'Failed to redeal cards')
        }
      } catch (err) {
        console.error('Failed to redeal cards:', err)
        dispatch({
          type: ACTION_TYPES.GAME.SET_ERROR,
          payload: {
            error:
              err instanceof Error ? err.message : 'Failed to redeal cards',
          },
        })
      }
    })
  }, [state.gameState, gameId, dispatch])

  return {
    actions: {
      initGame,
      loadGame,
      playCard: handlePlayCard,
      declareNapoleon: handleDeclareNapoleon,
      passNapoleon: handlePassNapoleon,
      setAdjutant: handleSetAdjutant,
      exchangeCards: handleExchangeCards,
      closeTrickResult: handleCloseTrickResult,
      redealCards: handleRedealCards,
    },
    isPending,
  }
}
