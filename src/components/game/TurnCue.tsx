'use client'

import { memo, useMemo } from 'react'
import { SUIT_NAME_PARTS, SUIT_SYMBOLS } from '@/lib/constants'
import type { GameState } from '@/types/game'

interface TurnCueProps {
  gameState: GameState
  currentPlayerId: string | null
  isCurrentTurn: boolean
}

export const TurnCue = memo(function TurnCue({
  gameState,
  currentPlayerId,
  isCurrentTurn,
}: TurnCueProps) {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex]
  const leadingSuit = gameState.leadingSuit

  const message = useMemo(() => {
    if (!isCurrentTurn) {
      return {
        main: `${currentPlayer?.name ?? 'Unknown'}'s Turn`,
        sub: 'Waiting for their play...',
      }
    }

    if (!leadingSuit) {
      return {
        main: 'Your Turn — Lead any card',
        sub: 'You are the first player in this trick. Play any card from your hand.',
      }
    }

    const suitSymbol = SUIT_SYMBOLS[leadingSuit]
    const suitName = SUIT_NAME_PARTS[leadingSuit]

    // Check if player can follow suit
    const player = gameState.players.find((p) => p.id === currentPlayerId)
    const canFollow = player?.hand.some((c) => c.suit === leadingSuit)

    if (!canFollow) {
      return {
        main: `Your Turn — Can't follow ${suitSymbol}`,
        sub: `You have no ${suitName}. Play any card.`,
      }
    }

    return {
      main: `Your Turn — Follow ${suitSymbol} ${suitName}`,
      sub: `Highest ${suitName} wins the trick. You must follow suit.`,
    }
  }, [
    isCurrentTurn,
    leadingSuit,
    currentPlayer,
    currentPlayerId,
    gameState.players,
  ])

  return (
    <div className="flex items-center gap-3.5 bg-gray-900/75 border border-white/10 rounded-[14px] px-4 py-3">
      {isCurrentTurn && (
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_16px_#facc15] animate-pulse shrink-0" />
      )}
      <div className="min-w-0">
        <div className="text-base md:text-lg font-extrabold text-white truncate">
          {message.main}
        </div>
        <div className="text-xs text-white/60 truncate">{message.sub}</div>
      </div>
    </div>
  )
})
