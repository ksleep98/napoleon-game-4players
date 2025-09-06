'use client'

import { useCallback, useTransition } from 'react'
import { processAIPlayingPhase } from '@/lib/ai/gameTricks'
import { ACTION_TYPES, GAME_PHASES } from '@/lib/constants'
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
  setAdjutant,
} from '@/lib/gameLogic'
import { setPlayerSession } from '@/lib/supabase/client'
import { loadGameState, saveGameState } from '@/lib/supabase/secureGameService'
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

          const newGame = isAI ? initializeAIGame('You') : initializeGame(names)

          const playerId = newGame.players[0]?.id || 'player_1'

          if (gameId) {
            newGame.id = gameId
          }

          dispatch({
            type: ACTION_TYPES.GAME.SET_GAME_STATE,
            payload: { gameState: newGame },
          })

          // プレイヤーセッション設定とゲーム保存を順序立てて実行
          if (gameId) {
            // プレイヤーセッション設定を試行（失敗は警告のみ）
            try {
              await setPlayerSession(playerId)
              console.log('Player session set to:', playerId)
            } catch (sessionError) {
              console.warn('Player session setup failed:', sessionError)
            }

            // 開発環境では直接セキュアサーバーアクションを使用、本番環境では段階的試行
            if (process.env.NODE_ENV === 'development') {
              // 開発環境：セキュアサーバーアクション経由で直接保存
              try {
                const { secureGameStateSave } = await import(
                  '@/lib/supabase/secureGameService'
                )
                await secureGameStateSave(newGame)
                console.log(
                  'Game state saved using secure server action (dev mode)'
                )
              } catch (secureError) {
                console.error('Secure save failed in dev mode:', secureError)
                throw new Error('Failed to save game state in development mode')
              }
            } else {
              // 本番環境：クライアント経由試行、失敗時セキュアサーバーアクション
              try {
                await saveGameState(newGame)
                console.log('Game state saved via client (prod mode)')
              } catch (clientSaveError) {
                console.warn(
                  'Client save failed, using secure server action:',
                  clientSaveError
                )
                try {
                  const { secureGameStateSave } = await import(
                    '@/lib/supabase/secureGameService'
                  )
                  await secureGameStateSave(newGame)
                  console.log(
                    'Game state saved using secure server action (prod fallback)'
                  )
                } catch (secureError) {
                  console.error('Secure save also failed:', secureError)
                  throw new Error(
                    'Failed to save game state: Both client and server methods failed'
                  )
                }
              }
            }
          } else {
            // ローカルゲームの場合は、プレイヤーセッションのみ設定（エラーは無視）
            try {
              await setPlayerSession(playerId)
              console.log('Player session set for local game:', playerId)
            } catch (sessionError) {
              console.warn(
                'Local game player session setup failed:',
                sessionError
              )
            }
          }

          console.log('Game initialized successfully:', newGame.id)
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
    [gameId, state.loading, state.gameState, state.initialized, isAI, dispatch]
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
            console.log('Game loaded successfully:', id)
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
      if (!state.gameState) return

      startTransition(async () => {
        try {
          dispatch({ type: ACTION_TYPES.GAME.RESET_ERROR })

          if (!state.gameState) return
          const updatedGame = playCard(state.gameState, playerId, cardId)

          if (
            isAI &&
            updatedGame.phase === GAME_PHASES.PLAYING &&
            !updatedGame.showingTrickResult
          ) {
            const currentPlayer = getCurrentPlayer(updatedGame)
            if (currentPlayer?.isAI) {
              setTimeout(async () => {
                try {
                  const aiUpdatedGame = await processAIPlayingPhase(updatedGame)
                  dispatch({
                    type: ACTION_TYPES.GAME.SET_GAME_STATE,
                    payload: { gameState: aiUpdatedGame },
                  })

                  if (gameId) {
                    await saveGameState(aiUpdatedGame)
                  }
                } catch (aiError) {
                  console.error('AI playing error:', aiError)
                }
              }, 1000)
            }
          }

          dispatch({
            type: ACTION_TYPES.GAME.SET_GAME_STATE,
            payload: { gameState: updatedGame },
          })

          if (gameId) {
            await saveGameState(updatedGame)
          }
        } catch (err) {
          dispatch({
            type: ACTION_TYPES.GAME.SET_ERROR,
            payload: {
              error: err instanceof Error ? err.message : 'Failed to play card',
            },
          })
        }
      })
    },
    [state.gameState, gameId, isAI, dispatch]
  )

  const handleSetNapoleon = useCallback(
    (playerId: string, napoleonCard?: Card) => {
      if (!state.gameState) return

      startTransition(async () => {
        try {
          dispatch({ type: ACTION_TYPES.GAME.RESET_ERROR })
          if (!state.gameState) return
          const updatedGame = declareNapoleon(
            state.gameState,
            playerId,
            napoleonCard
          )
          dispatch({
            type: ACTION_TYPES.GAME.SET_GAME_STATE,
            payload: { gameState: updatedGame },
          })

          if (gameId) {
            await saveGameState(updatedGame)
          }
        } catch (err) {
          dispatch({
            type: ACTION_TYPES.GAME.SET_ERROR,
            payload: {
              error:
                err instanceof Error ? err.message : 'Failed to set Napoleon',
            },
          })
        }
      })
    },
    [state.gameState, gameId, dispatch]
  )

  const handleDeclareNapoleonWithDeclaration = useCallback(
    (declaration: NapoleonDeclaration) => {
      if (!state.gameState) return

      startTransition(async () => {
        try {
          dispatch({ type: ACTION_TYPES.GAME.RESET_ERROR })
          if (!state.gameState) return
          const updatedGame = declareNapoleonWithDeclaration(
            state.gameState,
            declaration
          )
          dispatch({
            type: ACTION_TYPES.GAME.SET_GAME_STATE,
            payload: { gameState: updatedGame },
          })

          if (gameId) {
            await saveGameState(updatedGame)
          }
        } catch (err) {
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
      if (!state.gameState) return

      startTransition(async () => {
        try {
          dispatch({ type: ACTION_TYPES.GAME.RESET_ERROR })
          if (!state.gameState) return
          const updatedGame = passNapoleonDeclaration(state.gameState, playerId)
          dispatch({
            type: ACTION_TYPES.GAME.SET_GAME_STATE,
            payload: { gameState: updatedGame },
          })

          if (gameId) {
            await saveGameState(updatedGame)
          }
        } catch (err) {
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
      if (!state.gameState) return

      startTransition(async () => {
        try {
          dispatch({ type: ACTION_TYPES.GAME.RESET_ERROR })
          if (!state.gameState) return
          const updatedGame = setAdjutant(state.gameState, adjutantCard)
          dispatch({
            type: ACTION_TYPES.GAME.SET_GAME_STATE,
            payload: { gameState: updatedGame },
          })

          if (gameId && process.env.NODE_ENV === 'production') {
            await saveGameState(updatedGame)
          }
        } catch (err) {
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
      if (!state.gameState) return

      startTransition(async () => {
        try {
          dispatch({ type: ACTION_TYPES.GAME.RESET_ERROR })
          if (!state.gameState) return
          const updatedGame = exchangeCards(
            state.gameState,
            playerId,
            cardsToDiscard
          )
          dispatch({
            type: ACTION_TYPES.GAME.SET_GAME_STATE,
            payload: { gameState: updatedGame },
          })

          if (gameId && process.env.NODE_ENV === 'production') {
            await saveGameState(updatedGame)
          }
        } catch (err) {
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
    if (!state.gameState) return

    startTransition(async () => {
      try {
        dispatch({ type: ACTION_TYPES.GAME.RESET_ERROR })
        if (!state.gameState) return
        const updatedGame = closeTrickResult(state.gameState)
        dispatch({
          type: ACTION_TYPES.GAME.SET_GAME_STATE,
          payload: { gameState: updatedGame },
        })

        if (gameId && process.env.NODE_ENV === 'production') {
          await saveGameState(updatedGame)
        }

        if (isAI && updatedGame.phase === GAME_PHASES.PLAYING) {
          const currentPlayer = getCurrentPlayer(updatedGame)
          if (currentPlayer?.isAI) {
            setTimeout(async () => {
              try {
                const aiUpdatedGame = await processAIPlayingPhase(updatedGame)
                dispatch({
                  type: ACTION_TYPES.GAME.SET_GAME_STATE,
                  payload: { gameState: aiUpdatedGame },
                })

                if (gameId && process.env.NODE_ENV === 'production') {
                  await saveGameState(aiUpdatedGame)
                }
              } catch (aiError) {
                console.error('AI playing error after trick result:', aiError)
              }
            }, 1000)
          }
        }
      } catch (err) {
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
  }, [state.gameState, gameId, isAI, dispatch])

  return {
    actions: {
      initGame,
      loadGame,
      playCard: handlePlayCard,
      setNapoleon: handleSetNapoleon,
      declareNapoleonWithDeclaration: handleDeclareNapoleonWithDeclaration,
      passNapoleon: handlePassNapoleon,
      setAdjutant: handleSetAdjutant,
      exchangeCards: handleExchangeCards,
      closeTrickResult: handleCloseTrickResult,
    },
    isPending,
  }
}
