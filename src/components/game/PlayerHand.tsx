'use client'

import type { Player } from '@/types/game'
import { sortHand } from '@/utils/cardUtils'
import { Card } from './Card'
import { PlayerAvatar } from './PlayerAvatar'

interface PlayerHandProps {
  player: Player
  isCurrentPlayer?: boolean
  onCardClick?: (cardId: string) => void
  selectedCardId?: string
  playableCardIds?: string[]
}

export function PlayerHand({
  player,
  isCurrentPlayer = false,
  onCardClick,
  selectedCardId,
  playableCardIds = [],
}: PlayerHandProps) {
  const sortedHand = sortHand(player.hand)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <PlayerAvatar
          player={player}
          isCurrentUser
          isCurrentTurn={isCurrentPlayer}
          size="sm"
        />
        <h3 className="font-semibold text-lg text-white">{player.name}</h3>
        {isCurrentPlayer && (
          <span className="px-2 py-1 bg-yellow-400/20 text-yellow-300 rounded-full text-xs font-bold">
            Your Turn
          </span>
        )}
        <span
          className={`px-2 py-1 rounded-full text-xs font-bold ${player.hand.length !== 12 ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-white/60'}`}
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
