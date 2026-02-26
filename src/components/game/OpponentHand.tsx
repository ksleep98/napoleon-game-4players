'use client'

import type { Player } from '@/types/game'
import { Card } from './Card'

interface OpponentHandProps {
  player: Player
  isCurrentTurn?: boolean
  isAdjutantRevealed?: boolean
  isCurrentUser?: boolean
}

export function OpponentHand({
  player,
  isCurrentTurn = false,
  isAdjutantRevealed = false,
  isCurrentUser = false,
}: OpponentHandProps) {
  // カードの裏面を表示するためのダミーカード
  const backCards = Array.from({ length: player.hand.length }, (_, i) => ({
    id: `back-${player.id}-${i}`,
    rank: 'A' as const,
    suit: 'spades' as const,
    value: 0,
  }))

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-lg">{player.name}</h3>
        {player.isNapoleon && (
          <span className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full text-xs font-bold">
            Napoleon
          </span>
        )}
        {player.isAdjutant && (isCurrentUser || isAdjutantRevealed) && (
          <span className="px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs font-bold">
            Adjutant
          </span>
        )}
        {isCurrentTurn && (
          <span className="px-2 py-1 bg-blue-200 text-blue-800 rounded-full text-xs font-bold">
            Turn
          </span>
        )}
        <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded-full text-xs font-bold">
          {player.hand.length} cards
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {backCards.map((card) => (
          <Card
            key={card.id}
            card={card}
            isPlayable={false}
            isSelected={false}
            size="medium"
            faceDown={true}
          />
        ))}
      </div>
    </div>
  )
}
