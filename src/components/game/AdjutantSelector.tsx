'use client'

import { useState } from 'react'
import {
  CARD_RANKS,
  COUNTER_SUITS,
  createDeck,
  SPECIAL_CARDS,
  SUITS,
} from '@/lib/constants'
import type { Card as CardType, GameState, Suit } from '@/types/game'
import { Card } from './Card'

interface AdjutantSelectorProps {
  gameState: GameState
  napoleonPlayerId: string
  onAdjutantSelect: (adjutantCard: CardType) => void
}

// 裏スートを取得する関数
function getOppositeSuit(suit: Suit): Suit {
  const oppositeMap: Record<Suit, Suit> = COUNTER_SUITS
  return oppositeMap[suit]
}

// 重要なカードを特定する関数
function getImportantCards(trumpSuit: Suit): {
  mighty: CardType
  trumpJack: CardType
  oppositeJack: CardType
  aces: CardType[]
} {
  const allCards = createDeck()

  const mighty = allCards.find(
    (c) => c.suit === SPECIAL_CARDS.MIGHTY_SUIT && c.rank === CARD_RANKS.ACE
  )
  const trumpJack = allCards.find(
    (c) => c.suit === trumpSuit && c.rank === CARD_RANKS.JACK
  )
  const oppositeJack = allCards.find(
    (c) => c.suit === getOppositeSuit(trumpSuit) && c.rank === CARD_RANKS.JACK
  )
  const aces = allCards.filter((c) => c.rank === CARD_RANKS.ACE)

  if (!mighty || !trumpJack || !oppositeJack) {
    throw new Error('Required cards not found in deck')
  }

  return { mighty, trumpJack, oppositeJack, aces }
}

export function AdjutantSelector({
  gameState,
  napoleonPlayerId,
  onAdjutantSelect,
}: AdjutantSelectorProps) {
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null)
  const [viewMode, setViewMode] = useState<'important' | 'all'>('important')

  const napoleonPlayer = gameState.players.find(
    (p) => p.id === napoleonPlayerId
  )
  if (!napoleonPlayer) {
    return <div>Napoleon player not found</div>
  }

  if (!gameState.napoleonDeclaration) {
    return <div>Napoleon declaration not found</div>
  }

  const trumpSuit = gameState.napoleonDeclaration.suit
  const allCards = createDeck()
  const importantCards = getImportantCards(trumpSuit)

  const handleCardSelect = (cardId: string) => {
    const card = allCards.find((c) => c.id === cardId)
    setSelectedCard(card || null)
  }

  const getSuitDisplay = (suit: Suit) => {
    const suitMap = {
      clubs: '♣ クラブ',
      diamonds: '♦ ダイヤ',
      hearts: '♥ ハート',
      spades: '♠ スペード',
    }
    return suitMap[suit]
  }

  const getSuitColor = (suit: Suit) => {
    const colorMap = {
      clubs: 'text-gray-800',
      diamonds: 'text-red-500',
      hearts: 'text-red-500',
      spades: 'text-gray-800',
    }
    return colorMap[suit]
  }

  const handleConfirmSelection = () => {
    if (selectedCard) {
      onAdjutantSelect(selectedCard)
    }
  }

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow-lg">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Select Adjutant Card
        </h2>
        <p className="text-gray-600">
          {napoleonPlayer.name}, choose a card to find your adjutant!
        </p>
        <p className="text-sm text-gray-500 mt-2">
          The player who has this card will become your adjutant
        </p>
      </div>

      {/* 現在の宣言表示 */}
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
        <h3 className="text-lg font-bold text-yellow-800 mb-2">
          Your Napoleon Declaration
        </h3>
        <div className="flex items-center justify-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-700">
              {gameState.napoleonDeclaration.targetTricks}
            </div>
            <div className="text-sm text-yellow-600">tricks</div>
          </div>
          <div className="text-center">
            <div className={`text-3xl font-bold ${getSuitColor(trumpSuit)}`}>
              {getSuitDisplay(trumpSuit)}
            </div>
            <div className="text-sm text-yellow-600">trump suit</div>
          </div>
        </div>
      </div>

      {/* 表示モード切替 */}
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setViewMode('important')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'important'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Important Cards
        </button>
        <button
          type="button"
          onClick={() => setViewMode('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'all'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All 52 Cards
        </button>
      </div>

      {/* 重要なカード表示 */}
      {viewMode === 'important' && (
        <div className="space-y-4">
          {/* マイティー */}
          <div className="space-y-2">
            <h4 className="text-lg font-semibold text-red-600">
              🔥 Mighty (スペードのA)
            </h4>
            <div className="bg-red-50 p-3 rounded-lg">
              <Card
                card={importantCards.mighty}
                isSelected={selectedCard?.id === importantCards.mighty.id}
                isPlayable={true}
                size="small"
                onClick={handleCardSelect}
              />
            </div>
          </div>

          {/* ジャック */}
          <div className="space-y-2">
            <h4 className="text-lg font-semibold text-purple-600">
              ⚔️ Jacks (切り札と裏スートのJ)
            </h4>
            <div className="bg-purple-50 p-3 rounded-lg flex gap-2">
              <div className="text-center">
                <Card
                  card={importantCards.trumpJack}
                  isSelected={selectedCard?.id === importantCards.trumpJack.id}
                  isPlayable={true}
                  size="small"
                  onClick={handleCardSelect}
                />
                <p className="text-xs mt-1 text-purple-600">Trump Jack</p>
              </div>
              <div className="text-center">
                <Card
                  card={importantCards.oppositeJack}
                  isSelected={
                    selectedCard?.id === importantCards.oppositeJack.id
                  }
                  isPlayable={true}
                  size="small"
                  onClick={handleCardSelect}
                />
                <p className="text-xs mt-1 text-purple-600">Opposite Jack</p>
              </div>
            </div>
          </div>

          {/* エース */}
          <div className="space-y-2">
            <h4 className="text-lg font-semibold text-green-600">
              👑 Aces (各スートのA)
            </h4>
            <div className="bg-green-50 p-3 rounded-lg flex flex-wrap gap-2">
              {importantCards.aces.map((ace) => (
                <div key={ace.id} className="text-center">
                  <Card
                    card={ace}
                    isSelected={selectedCard?.id === ace.id}
                    isPlayable={true}
                    size="small"
                    onClick={handleCardSelect}
                  />
                  <p className={`text-xs mt-1 ${getSuitColor(ace.suit)}`}>
                    {getSuitDisplay(ace.suit)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 全カード表示 */}
      {viewMode === 'all' && (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold">All 52 Cards:</h4>
          <div className="space-y-3">
            {SUITS.map((suit) => (
              <div key={suit} className="space-y-2">
                <h5 className={`font-medium ${getSuitColor(suit as Suit)}`}>
                  {getSuitDisplay(suit as Suit)}
                </h5>
                <div className="flex flex-wrap gap-1 bg-gray-50 p-2 rounded-lg">
                  {allCards
                    .filter((card) => card.suit === suit)
                    .sort((a, b) => b.value - a.value)
                    .map((card) => (
                      <Card
                        key={card.id}
                        card={card}
                        isSelected={selectedCard?.id === card.id}
                        isPlayable={true}
                        size="small"
                        onClick={handleCardSelect}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 選択されたカード表示 */}
      {selectedCard && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm mb-2">
            Selected adjutant card:{' '}
            <span className="font-semibold">
              {selectedCard.rank} of {getSuitDisplay(selectedCard.suit)}
            </span>
          </p>
          <div className="flex justify-center mb-2">
            <Card
              card={selectedCard}
              isSelected={true}
              isPlayable={false}
              size="medium"
              onClick={() => {}}
            />
          </div>
          <p className="text-xs text-gray-600 text-center">
            The player who has this card will be your adjutant
          </p>
        </div>
      )}

      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleConfirmSelection}
          disabled={!selectedCard}
          className="px-8 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold rounded-lg transition-colors shadow-lg disabled:cursor-not-allowed"
        >
          Confirm Adjutant Selection
        </button>
      </div>

      <div className="text-xs text-gray-500 text-center space-y-1">
        <p>💡 Important cards are typically strong choices for adjutants</p>
        <p>If the selected card is in the hidden pile, you'll play alone</p>
      </div>
    </div>
  )
}
