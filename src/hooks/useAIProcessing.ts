'use client'

import { useEffect } from 'react'
import { processAIPlayingPhase } from '@/lib/ai/gameTricks'
import { GAME_PHASES } from '@/lib/constants'
import { getCurrentPlayer, processAITurn } from '@/lib/gameLogic'
import { getNextDeclarationPlayer } from '@/lib/napoleonRules'
import { saveGameState } from '@/lib/supabase/secureGameService'
import type { GameState } from '@/types/game'

interface UseAIProcessingProps {
  gameState: GameState | null
  isAI: boolean | undefined
  gameId: string | undefined
  onGameStateUpdate: (gameState: GameState) => void
}

export function useAIProcessing({
  gameState,
  isAI,
  gameId,
  onGameStateUpdate,
}: UseAIProcessingProps) {
  useEffect(() => {
    if (!gameState || !isAI) return

    const processAI = async () => {
      try {
        if (gameState.phase === GAME_PHASES.NAPOLEON) {
          const nextPlayer = getNextDeclarationPlayer(gameState)
          if (!nextPlayer || !nextPlayer.isAI) {
            return
          }
        }

        if (
          gameState.phase === GAME_PHASES.NAPOLEON ||
          gameState.phase === GAME_PHASES.ADJUTANT ||
          gameState.phase === GAME_PHASES.EXCHANGE
        ) {
          const updatedState = await processAITurn(gameState)
          if (
            updatedState !== gameState &&
            JSON.stringify(updatedState) !== JSON.stringify(gameState)
          ) {
            onGameStateUpdate(updatedState)
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
        } else if (gameState.phase === GAME_PHASES.PLAYING) {
          if (gameState.showingTrickResult) {
            return
          }

          const currentPlayer = getCurrentPlayer(gameState)
          if (currentPlayer?.isAI) {
            const updatedState = await processAIPlayingPhase(gameState)
            if (
              updatedState !== gameState &&
              JSON.stringify(updatedState) !== JSON.stringify(gameState)
            ) {
              onGameStateUpdate(updatedState)
              if (gameId && process.env.NODE_ENV === 'production') {
                try {
                  await saveGameState(updatedState)
                } catch (saveError) {
                  console.error('Failed to save AI playing state:', saveError)
                }
              }
            }
          }
        } else if (gameState.phase === GAME_PHASES.FINISHED) {
          if (gameState.showingTrickResult) {
            return
          }
        }
      } catch (error) {
        console.error('AI processing error:', error)
      }
    }

    const timer = setTimeout(processAI, 1500)
    return () => clearTimeout(timer)
  }, [gameState, isAI, gameId, onGameStateUpdate])
}
