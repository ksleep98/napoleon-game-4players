'use client'

import type { Player } from '@/types/game'
import { sortHand } from '@/utils/cardUtils'
import { Card } from './Card'

interface PlayerHandProps {
  player: Player
  isCurrentPlayer?: boolean
  onCardClick?: (cardId: string) => void
  selectedCardId?: string
  playableCardIds?: string[]
  showCards?: boolean
}

export function PlayerHand({
  player,
  isCurrentPlayer = false,
  onCardClick,
  selectedCardId,
  playableCardIds = [],
  showCards = false,
}: PlayerHandProps) {
  const sortedHand = sortHand(player.hand)

  // デバッグ: 手札枚数をログ出力（開発環境のみ）
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `Player ${player.name} has ${player.hand.length} cards:`,
      player.hand.map((c) => `${c.rank}${c.suit}`).join(', ')
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-lg">{player.name}</h3>
        {player.isNapoleon && (
          <span className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full text-xs font-bold">
            Napoleon
          </span>
        )}
        {player.isAdjutant && (
          <span className="px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs font-bold">
            Adjutant
          </span>
        )}
        {isCurrentPlayer && (
          <span className="px-2 py-1 bg-blue-200 text-blue-800 rounded-full text-xs font-bold">
            Your Turn
          </span>
        )}
        <span
          className={`px-2 py-1 rounded-full text-xs font-bold ${player.hand.length !== 12 ? 'bg-red-200 text-red-800' : 'bg-gray-200 text-gray-600'}`}
        >
          {player.hand.length} cards
          {player.hand.length !== 12 && ' ⚠️'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {sortedHand.map((card) => (
          <Card
            key={card.id}
            card={card}
            isPlayable={isCurrentPlayer && playableCardIds.includes(card.id)}
            isSelected={selectedCardId === card.id}
            size="medium"
            onClick={onCardClick}
          />
        ))}
      </div>
    </div>
  )
}
