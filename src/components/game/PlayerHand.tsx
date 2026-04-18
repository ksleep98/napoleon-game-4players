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
  fanLayout?: boolean
}

export function PlayerHand({
  player,
  isCurrentPlayer = false,
  onCardClick,
  selectedCardId,
  playableCardIds = [],
  fanLayout = false,
}: PlayerHandProps) {
  const sortedHand = sortHand(player.hand)
  const N = sortedHand.length

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

      {fanLayout && N > 0 ? (
        <div className="relative h-[160px] md:h-[200px] w-full max-w-[900px] mx-auto flex items-end justify-center overflow-visible">
          {sortedHand.map((card, i) => {
            const spread = 65
            const xRadius = 340
            const yRadius = 40
            const t = N === 1 ? 0 : i / (N - 1)
            const deg = -spread / 2 + t * spread
            const rad = (deg * Math.PI) / 180
            const x = Math.sin(rad) * xRadius
            const y = -Math.cos(rad) * yRadius + yRadius
            const isSelected = selectedCardId === card.id

            return (
              <div
                key={card.id}
                className="absolute bottom-0 origin-bottom transition-transform duration-200"
                style={{
                  transform: `translate(${x}px, ${y}px) rotate(${deg}deg)${isSelected ? ' translateY(-14px)' : ''}`,
                  zIndex: isSelected ? 50 : i,
                }}
              >
                <Card
                  card={card}
                  isPlayable={
                    isCurrentPlayer && playableCardIds.includes(card.id)
                  }
                  isSelected={isSelected}
                  size="medium"
                  onClick={onCardClick}
                />
              </div>
            )
          })}
        </div>
      ) : (
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
      )}
    </div>
  )
}
