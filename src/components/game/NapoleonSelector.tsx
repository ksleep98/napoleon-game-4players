'use client'

import { useEffect, useId, useState } from 'react'
import { getMinimumDeclaration } from '@/lib/napoleonRules'
import type {
  Card as CardType,
  NapoleonDeclaration,
  Player,
  Suit,
} from '@/types/game'
import { sortHand } from '@/utils/cardUtils'
import { Card } from './Card'

interface NapoleonSelectorProps {
  players: Player[]
  currentPlayerId: string | null
  currentDeclaration?: NapoleonDeclaration
  onNapoleonSelect: (playerId: string, declaration: NapoleonDeclaration) => void
  onPass: (playerId: string) => void
}

export function NapoleonSelector({
  players,
  currentPlayerId,
  currentDeclaration,
  onNapoleonSelect,
  onPass,
}: NapoleonSelectorProps) {
  // 現在の最小宣言を取得
  const minDeclaration = getMinimumDeclaration(currentDeclaration)

  const [selectedCard, setSelectedCard] = useState<CardType | null>(null)
  const [selectedTricks, setSelectedTricks] = useState<number>(
    minDeclaration.minTricks
  )
  const [selectedSuit, setSelectedSuit] = useState<Suit>(
    minDeclaration.availableSuits.length > 0
      ? minDeclaration.availableSuits[0]
      : 'clubs'
  )
  const tricksSelectId = useId()
  const suitSelectId = useId()
  const currentPlayer = currentPlayerId
    ? players.find((p) => p.id === currentPlayerId)
    : null

  // 現在の宣言が変わった時に初期値を更新
  useEffect(() => {
    const newMinDeclaration = getMinimumDeclaration(currentDeclaration)
    setSelectedTricks(newMinDeclaration.minTricks)
    if (newMinDeclaration.availableSuits.length > 0) {
      setSelectedSuit(newMinDeclaration.availableSuits[0])
    }
  }, [currentDeclaration])

  if (!currentPlayer || !currentPlayerId) {
    return <div>Player not found</div>
  }
  const availableTricks = Array.from(
    { length: 21 - minDeclaration.minTricks },
    (_, i) => minDeclaration.minTricks + i
  )

  // 現在の宣言と同じトリック数の場合は、より強いスートのみ選択可能
  const availableSuits: Suit[] =
    currentDeclaration && selectedTricks === currentDeclaration.targetTricks
      ? minDeclaration.availableSuits
      : ['clubs', 'diamonds', 'hearts', 'spades']

  const handleCardSelect = (cardId: string) => {
    const card = currentPlayer.hand.find((c) => c.id === cardId)
    setSelectedCard(card || null)
  }

  const handleNapoleonDeclaration = () => {
    const declaration: NapoleonDeclaration = {
      playerId: currentPlayerId,
      targetTricks: selectedTricks,
      suit: selectedSuit,
      adjutantCard: selectedCard || undefined,
    }
    onNapoleonSelect(currentPlayerId, declaration)
  }

  const handlePass = () => {
    onPass(currentPlayerId)
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

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow-lg">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Napoleon Declaration
        </h2>
        <p className="text-gray-600">
          {currentPlayer.name}, declare your Napoleon bid!
        </p>
        {currentDeclaration && (
          <div className="mt-2 p-2 bg-yellow-100 rounded">
            <p className="text-sm">
              Current bid:{' '}
              <span className="font-bold">
                {currentDeclaration.targetTricks}
              </span>{' '}
              face cards with{' '}
              <span className="font-bold">
                {getSuitDisplay(currentDeclaration.suit)}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* トリック数とスート選択 */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* トリック数選択 */}
          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-2"
              htmlFor={tricksSelectId}
            >
              Target Face Cards (絵札数)
            </label>
            <select
              id={tricksSelectId}
              value={selectedTricks}
              onChange={(e) => setSelectedTricks(Number(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            >
              {availableTricks.map((tricks) => (
                <option key={tricks} value={tricks}>
                  {tricks} face cards
                </option>
              ))}
            </select>
          </div>

          {/* スート選択 */}
          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-2"
              htmlFor={suitSelectId}
            >
              Trump Suit (切り札)
            </label>
            <select
              id={suitSelectId}
              value={selectedSuit}
              onChange={(e) => setSelectedSuit(e.target.value as Suit)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            >
              {availableSuits.map((suit) => (
                <option
                  key={suit}
                  value={suit}
                  disabled={!availableSuits.includes(suit)}
                >
                  {getSuitDisplay(suit)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 宣言の詳細 */}
        <div className="bg-blue-50 p-3 rounded-lg">
          <p className="text-sm font-medium text-blue-800">
            Your declaration:{' '}
            <span className="font-bold">{selectedTricks}</span> face cards with{' '}
            <span className="font-bold">{getSuitDisplay(selectedSuit)}</span>
          </p>
          <p className="text-xs text-blue-600 mt-1">
            You and your adjutant must win at least {selectedTricks} out of 20
            face cards total
          </p>
        </div>
      </div>

      {/* 副官カード選択 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          Select adjutant card (副官カード選択):
        </h3>
        <p className="text-sm text-gray-600">
          Choose a card that your adjutant should have
        </p>

        {/* スート別に手札を表示 */}
        <div className="space-y-3">
          {['spades', 'hearts', 'diamonds', 'clubs'].map((suit) => {
            const suitCards = sortHand(currentPlayer.hand).filter(
              (card) => card.suit === suit
            )
            if (suitCards.length === 0) return null

            return (
              <div key={suit} className="space-y-2">
                <h4
                  className={`text-sm font-medium ${getSuitColor(suit as Suit)}`}
                >
                  {getSuitDisplay(suit as Suit)} ({suitCards.length} cards)
                </h4>
                <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded">
                  {suitCards.map((card) => (
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
            )
          })}
        </div>

        {selectedCard && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm">
              Selected card:{' '}
              <span className="font-semibold">
                {selectedCard.rank} of {selectedCard.suit}
              </span>
            </p>
            <p className="text-xs text-gray-600 mt-1">
              The player who has this card will be your adjutant
            </p>
          </div>
        )}
      </div>

      {/* アクションボタン */}
      <div className="flex gap-4 justify-center">
        <button
          type="button"
          onClick={handleNapoleonDeclaration}
          className="px-8 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg transition-colors shadow-lg"
        >
          Declare Napoleon
          <div className="text-xs mt-1">
            {selectedTricks} {getSuitDisplay(selectedSuit)}
          </div>
        </button>

        <button
          type="button"
          onClick={handlePass}
          className="px-8 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors shadow-lg"
        >
          Pass
        </button>
      </div>

      {/* 説明 */}
      <div className="text-xs text-gray-500 text-center space-y-1">
        <p>
          As Napoleon, you and your adjutant need to win your declared number of
          face cards
        </p>
        <p>
          Higher face card counts and stronger suits beat lower declarations
        </p>
        <p>If you don't select an adjutant card, one will be chosen randomly</p>
      </div>
    </div>
  )
}
