'use client'

import { useEffect, useId, useState } from 'react'
import { SUIT_DISPLAY_COLORS, SUIT_NAMES, SUITS } from '@/lib/constants'
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
      : SUITS

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
    return SUIT_NAMES[suit]
  }

  const getSuitColor = (suit: Suit) => {
    return SUIT_DISPLAY_COLORS[suit]
  }

  // 現在の宣言プレイヤー情報を取得
  const currentDeclarationPlayer = currentDeclaration
    ? players.find((p) => p.id === currentDeclaration.playerId)
    : null

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow-lg">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          🎩 Napoleon Declaration Phase
        </h2>
        <p className="text-gray-600">
          <span className="font-semibold">{currentPlayer.name}</span>, it's your
          turn to declare!
        </p>
      </div>

      {/* 現在の最高宣言表示 */}
      {currentDeclaration && currentDeclarationPlayer ? (
        <div className="border border-yellow-300 bg-yellow-50 p-4 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-3 text-center">
            🏆 Current Highest Bid
          </h3>
          <div className="bg-white rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="text-sm text-gray-600">Player</div>
                <div className="text-lg font-bold text-yellow-700">
                  {currentDeclarationPlayer.name}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600">Face Cards</div>
                <div className="text-2xl font-bold text-yellow-700">
                  {currentDeclaration.targetTricks}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600">Trump Suit</div>
                <div
                  className={`text-2xl font-bold ${getSuitColor(currentDeclaration.suit)}`}
                >
                  {getSuitDisplay(currentDeclaration.suit)}
                </div>
              </div>
            </div>
          </div>
          <div className="text-center text-sm text-yellow-700 mt-2">
            You must bid higher to become Napoleon!
          </div>
        </div>
      ) : (
        <div className="border border-blue-300 bg-blue-50 p-4 rounded-lg">
          <div className="text-center">
            <h3 className="font-semibold text-blue-800 mb-2">
              🚀 Be the first to bid!
            </h3>
            <p className="text-sm text-blue-600">
              No bids yet - you can start with any face card count and trump
              suit!
            </p>
          </div>
        </div>
      )}

      {/* トリック数とスート選択 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-center">Make Your Bid</h3>
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
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-lg font-medium"
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
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-lg font-medium"
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

        {/* 宣言プレビュー */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 p-4 rounded-lg">
          <div className="text-center">
            <div className="text-sm text-gray-600 mb-2">
              Your Declaration Preview:
            </div>
            <div className="flex items-center justify-center gap-4">
              <div className="bg-white rounded-lg px-4 py-2 shadow-sm">
                <div className="text-2xl font-bold text-blue-600">
                  {selectedTricks}
                </div>
                <div className="text-xs text-gray-600">face cards</div>
              </div>
              <div className="text-xl font-bold text-gray-400">+</div>
              <div className="bg-white rounded-lg px-4 py-2 shadow-sm">
                <div
                  className={`text-2xl font-bold ${getSuitColor(selectedSuit)}`}
                >
                  {getSuitDisplay(selectedSuit).split(' ')[0]}
                </div>
                <div className="text-xs text-gray-600">trump</div>
              </div>
            </div>
            <div className="text-xs text-gray-600 mt-2">
              You and your adjutant must win at least {selectedTricks} out of 20
              face cards total
            </div>
          </div>
        </div>
      </div>

      {/* 副官カード選択 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          👤 Select Adjutant Card (副官カード選択):
        </h3>
        <p className="text-sm text-gray-600">
          Choose a card that your future adjutant should have (optional)
        </p>

        {/* スート別に手札を表示 */}
        <div className="space-y-3">
          {SUITS.map((suit) => {
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
          <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
            <p className="text-sm">
              Selected adjutant card:{' '}
              <span className="font-semibold">
                {selectedCard.rank} of {selectedCard.suit}
              </span>
            </p>
            <p className="text-xs text-green-600 mt-1">
              The player who has this card will be your adjutant
            </p>
          </div>
        )}
      </div>

      {/* アクションボタン */}
      <div className="flex gap-4 justify-center pt-4">
        <button
          type="button"
          onClick={handleNapoleonDeclaration}
          className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          🎩 Declare Napoleon
          <div className="text-xs mt-1 opacity-90">
            {selectedTricks} {getSuitDisplay(selectedSuit)}
          </div>
        </button>

        <button
          type="button"
          onClick={handlePass}
          className="px-8 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-xl"
        >
          ⏭️ Pass
        </button>
      </div>

      {/* 説明 */}
      <div className="text-xs text-gray-500 text-center space-y-1 pt-2">
        <p>
          💡 As Napoleon, you and your adjutant need to win your declared number
          of face cards
        </p>
        <p>
          🎯 Higher face card counts and stronger suits (♠ {'>'} ♥ {'>'} ♦ {'>'}{' '}
          ♣) beat lower declarations
        </p>
        <p>
          🎲 If you don't select an adjutant card, one will be chosen randomly
        </p>
      </div>
    </div>
  )
}
