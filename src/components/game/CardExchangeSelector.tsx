'use client'

import { useState } from 'react'
import type { Card as CardType, GameState } from '@/types/game'
import { sortHand } from '@/utils/cardUtils'
import { Card } from './Card'
import { DeclarationDisplay } from './DeclarationDisplay'

interface CardExchangeSelectorProps {
  gameState: GameState
  napoleonPlayerId: string
  onCardExchange: (cardsToDiscard: CardType[]) => void
}

export function CardExchangeSelector({
  gameState,
  napoleonPlayerId,
  onCardExchange,
}: CardExchangeSelectorProps) {
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set())

  const napoleonPlayer = gameState.players.find(
    (p) => p.id === napoleonPlayerId
  )
  if (!napoleonPlayer) {
    return <div>Napoleon player not found</div>
  }

  // ナポレオンの手札は既に16枚（元の12枚 + 隠しカード4枚）になっている
  const allCards = napoleonPlayer.hand
  const needToSelect = 4 - selectedCards.size

  const handleCardClick = (cardId: string) => {
    const newSelected = new Set(selectedCards)

    if (newSelected.has(cardId)) {
      newSelected.delete(cardId)
    } else if (newSelected.size < 4) {
      newSelected.add(cardId)
    }

    setSelectedCards(newSelected)
  }

  const handleConfirmExchange = () => {
    if (selectedCards.size === 4) {
      const cardsToDiscard = allCards.filter((card) =>
        selectedCards.has(card.id)
      )
      onCardExchange(cardsToDiscard)
    }
  }

  // カードソース判定は不要になりました（すべて手札に統合済み）

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow-lg">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Card Exchange</h2>
        <p className="text-gray-600">
          {napoleonPlayer.name}, select 4 cards to discard
        </p>
        <div className="mt-2">
          <span
            className={`text-lg font-semibold ${needToSelect === 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {needToSelect === 0
              ? 'Ready to exchange!'
              : `Select ${needToSelect} more card${needToSelect !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* Display the adopted Napoleon declaration */}
      {gameState.napoleonDeclaration && (
        <DeclarationDisplay
          declaration={gameState.napoleonDeclaration}
          showTitle={true}
        />
      )}

      <div className="space-y-6">
        {/* Original Hand (12 cards) */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-blue-700">
            Your Original Hand (12 cards):
          </h3>
          <div className="flex flex-wrap gap-2 p-3 bg-blue-50 rounded-lg">
            {sortHand(allCards.filter((card) => !card.wasHidden)).map(
              (card) => (
                <Card
                  key={card.id}
                  card={card}
                  isSelected={selectedCards.has(card.id)}
                  isPlayable={true}
                  size="small"
                  onClick={handleCardClick}
                />
              )
            )}
          </div>
        </div>

        {/* Hidden Cards (4 cards) */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-yellow-700">
            Hidden Cards (4 cards you received):
          </h3>
          <div className="flex flex-wrap gap-2 p-3 bg-yellow-50 rounded-lg border-2 border-yellow-200">
            {sortHand(allCards.filter((card) => card.wasHidden)).map((card) => (
              <Card
                key={card.id}
                card={card}
                isSelected={selectedCards.has(card.id)}
                isPlayable={true}
                size="small"
                onClick={handleCardClick}
              />
            ))}
          </div>
          <p className="text-sm text-yellow-700 text-center font-medium">
            💡 These were the 4 hidden cards you received as Napoleon!
          </p>
        </div>

        {/* Selected Cards Summary */}
        {selectedCards.size > 0 && (
          <div className="bg-green-50 p-3 rounded-lg">
            <h4 className="font-semibold mb-2">Selected cards to discard:</h4>
            <div className="flex flex-wrap gap-2">
              {Array.from(selectedCards).map((cardId) => {
                const card = allCards.find((c) => c.id === cardId)
                return card ? (
                  <div key={cardId} className="text-center">
                    <Card
                      card={card}
                      isSelected={true}
                      isPlayable={false}
                      size="small"
                      onClick={() => {}}
                    />
                    <span
                      className={`text-xs mt-1 block ${card.wasHidden ? 'text-yellow-600' : 'text-blue-600'}`}
                    >
                      {card.wasHidden ? 'Hidden' : 'Original'}
                    </span>
                  </div>
                ) : null
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleConfirmExchange}
          disabled={selectedCards.size !== 4}
          className="px-8 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-bold rounded-lg transition-colors shadow-lg disabled:cursor-not-allowed"
        >
          Exchange Cards
        </button>
      </div>

      <div className="text-xs text-gray-500 text-center space-y-1">
        <p>
          Choose 4 cards to discard. You'll keep the remaining 12 cards for the
          game.
        </p>
        <p>
          <span className="text-blue-600">■</span> Blue = Your original hand •
          <span className="text-yellow-600">■</span> Yellow = Hidden cards
        </p>
      </div>
    </div>
  )
}
