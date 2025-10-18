'use client'

import { useEffect } from 'react'
import { processAITurnAction } from '@/app/actions/aiStrategyActions'
import { GAME_PHASES } from '@/lib/constants'
import { getCurrentPlayer } from '@/lib/gameLogic'
import { getNextDeclarationPlayer } from '@/lib/napoleonRules'
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

    // ゲーム状態から実際のゲームIDを取得（URLのgameIdではなく）
    const actualGameId = gameState.id || gameId
    if (!actualGameId) return

    const processAI = async () => {
      try {
        if (gameState.phase === GAME_PHASES.NAPOLEON) {
          const nextPlayer = getNextDeclarationPlayer(gameState)
          if (!nextPlayer || !nextPlayer.isAI) {
            return
          }

          console.log(
            `AI processing Napoleon phase for player: ${nextPlayer.name} with gameId: ${actualGameId}`
          )

          const result = await processAITurnAction(
            actualGameId,
            gameState.players[0]?.id || 'player_0'
          )

          if (result.success && result.data) {
            onGameStateUpdate(result.data)
            console.log('AI Napoleon processing completed successfully')
          } else {
            console.error('AI Napoleon processing failed:', result.error)
          }
        } else if (gameState.phase === GAME_PHASES.ADJUTANT) {
          // 副官フェーズでのAI処理
          const napoleonPlayer = gameState.players.find((p) => p.isNapoleon)
          if (napoleonPlayer?.isAI) {
            console.log(
              `AI processing Adjutant phase for Napoleon: ${napoleonPlayer.name} with gameId: ${actualGameId}`
            )

            const result = await processAITurnAction(
              actualGameId,
              gameState.players[0]?.id || 'player_0'
            )

            if (result.success && result.data) {
              onGameStateUpdate(result.data)
              console.log('AI Adjutant processing completed successfully')
            } else {
              console.error('AI Adjutant processing failed:', result.error)
            }
          }
        } else if (gameState.phase === GAME_PHASES.EXCHANGE) {
          // カード交換フェーズでのAI処理
          const napoleonPlayer = gameState.players.find((p) => p.isNapoleon)
          if (napoleonPlayer?.isAI) {
            console.log(
              `AI processing Exchange phase for Napoleon: ${napoleonPlayer.name} with gameId: ${actualGameId}`
            )

            const result = await processAITurnAction(
              actualGameId,
              gameState.players[0]?.id || 'player_0'
            )

            if (result.success && result.data) {
              onGameStateUpdate(result.data)
              console.log('AI Exchange processing completed successfully')
            } else {
              console.error('AI Exchange processing failed:', result.error)
            }
          }
        } else if (gameState.phase === GAME_PHASES.PLAYING) {
          if (gameState.showingTrickResult) {
            return
          }

          const currentPlayer = getCurrentPlayer(gameState)
          if (currentPlayer?.isAI) {
            console.log(
              `AI processing Playing phase for player: ${currentPlayer.name} with gameId: ${actualGameId}`
            )

            const result = await processAITurnAction(
              actualGameId,
              gameState.players[0]?.id || 'player_0'
            )

            if (result.success && result.data) {
              onGameStateUpdate(result.data)
              console.log('AI Playing processing completed successfully')
            } else {
              console.error('AI Playing processing failed:', result.error)
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
