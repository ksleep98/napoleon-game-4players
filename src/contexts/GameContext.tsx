'use client'

import { createContext, useCallback, useContext, useReducer } from 'react'
import { useAIProcessing } from '@/hooks/useAIProcessing'
import { useGameActions } from '@/hooks/useGameActions'
import { useGameInitialization } from '@/hooks/useGameInitialization'
import { useGameSubscription } from '@/hooks/useGameSubscription'
import { usePlayerSession } from '@/hooks/useSupabase'
import { ACTION_TYPES, GAME_PHASES } from '@/lib/constants'
import { getCurrentPlayer } from '@/lib/gameLogic'
import type {
  Card,
  GameAction,
  GameContextState,
  GameState,
  NapoleonDeclaration,
  Player,
} from '@/types/game'

function gameReducer(
  state: GameContextState,
  action: GameAction
): GameContextState {
  switch (action.type) {
    case ACTION_TYPES.GAME.SET_LOADING:
      return {
        ...state,
        loading: action.payload?.loading ?? true,
      }
    case ACTION_TYPES.GAME.SET_ERROR:
      return {
        ...state,
        error: action.payload?.error ?? null,
        loading: false,
      }
    case ACTION_TYPES.GAME.SET_GAME_STATE:
      return {
        ...state,
        gameState: action.payload?.gameState ?? null,
        loading: false,
      }
    case ACTION_TYPES.GAME.SET_INITIALIZED:
      return {
        ...state,
        initialized: action.payload?.initialized ?? true,
      }
    case ACTION_TYPES.GAME.RESET_ERROR:
      return {
        ...state,
        error: null,
      }
    case ACTION_TYPES.GAME.RESET_STATE:
      return {
        gameState: null,
        loading: false,
        error: null,
        initialized: false,
      }
    default:
      return state
  }
}

interface GameContextValue {
  gameState: GameState | null
  loading: boolean
  error: string | null
  isPending?: boolean
  actions: {
    initGame: (names: string[]) => void
    loadGame: (id: string) => void
    playCard: (playerId: string, cardId: string) => void
    declareNapoleon: (declaration: NapoleonDeclaration) => void
    passNapoleon: (playerId: string) => void
    setAdjutant: (adjutantCard: Card) => void
    exchangeCards: (playerId: string, cardsToDiscard: Card[]) => void
    closeTrickResult: () => void
  }
  utils: {
    getPlayableCards: (playerId: string) => string[]
    getCurrentPlayer: () => Player | null
  }
}

const GameContext = createContext<GameContextValue | null>(null)

interface GameProviderProps {
  children: React.ReactNode
  gameId?: string
  playerNames?: string[]
  isAI?: boolean
}

export function GameProvider({
  children,
  gameId,
  playerNames,
  isAI,
}: GameProviderProps) {
  const [state, dispatch] = useReducer(gameReducer, {
    gameState: null,
    loading: false,
    error: null,
    initialized: false,
  })

  const { isAuthenticated } = usePlayerSession()

  // ゲーム初期化後は実際のゲームIDを使用、そうでなければURLのゲームIDを使用
  const actualGameId = state.gameState?.id || gameId

  console.log(
    'GameProvider - URL gameId:',
    gameId,
    'Actual gameId:',
    actualGameId
  )

  // Use the optimized actions hook with React 19 transitions
  const { actions, isPending } = useGameActions({
    state,
    dispatch,
    gameId: actualGameId,
    isAI,
  })

  const getPlayableCards = useCallback(
    (playerId: string): string[] => {
      if (!state.gameState || state.gameState.phase !== GAME_PHASES.PLAYING)
        return []

      const player = state.gameState.players.find((p) => p.id === playerId)
      if (!player) return []

      const currentPlayer = getCurrentPlayer(state.gameState)
      if (!currentPlayer || currentPlayer.id !== playerId) return []

      if (state.gameState.leadingSuit) {
        const suitCards = player.hand.filter(
          (card) => card.suit === state.gameState?.leadingSuit
        )
        if (suitCards.length > 0) {
          return suitCards.map((card) => card.id)
        }
      }

      return player.hand.map((card) => card.id)
    },
    [state.gameState]
  )

  const handleGameStateUpdate = useCallback((gameState: GameState) => {
    dispatch({ type: 'SET_GAME_STATE', payload: { gameState } })
  }, [])

  // Use separated custom hooks for side effects
  useGameSubscription(gameId, isAuthenticated, handleGameStateUpdate)

  useGameInitialization({
    gameId,
    playerNames,
    isAI,
    hasGameState: !!state.gameState,
    isLoading: state.loading,
    isInitialized: state.initialized,
    initGame: actions.initGame,
    loadGame: actions.loadGame,
  })

  useAIProcessing({
    gameState: state.gameState,
    isAI,
    gameId,
    onGameStateUpdate: handleGameStateUpdate,
  })

  const contextValue: GameContextValue = {
    gameState: state.gameState,
    loading: state.loading || isPending,
    error: state.error,
    isPending,
    actions,
    utils: {
      getPlayableCards,
      getCurrentPlayer: () =>
        state.gameState ? getCurrentPlayer(state.gameState) : null,
    },
  }

  return (
    <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>
  )
}

export function useGame() {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGame must be used within a GameProvider')
  }
  return context
}
