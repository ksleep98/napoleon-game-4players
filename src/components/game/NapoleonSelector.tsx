'use client'

import { useState } from 'react'
import { Card as CardType, Player } from '@/types/game'
import { Card } from './Card'

interface NapoleonSelectorProps {
  players: Player[]
  currentPlayerId: string
  onNapoleonSelect: (playerId: string, napoleonCard?: CardType) => void
}

export function NapoleonSelector({
  players,
  currentPlayerId,
  onNapoleonSelect,
}: NapoleonSelectorProps) {
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null)
  const currentPlayer = players.find((p) => p.id === currentPlayerId)

  if (!currentPlayer) {
    return <div>Player not found</div>
  }

  const handleCardSelect = (cardId: string) => {
    const card = currentPlayer.hand.find((c) => c.id === cardId)
    setSelectedCard(card || null)
  }

  const handleNapoleonDeclaration = () => {
    onNapoleonSelect(currentPlayerId, selectedCard || undefined)
  }

  const handlePass = () => {
    // パスの場合は次のプレイヤーに移行
    const currentIndex = players.findIndex((p) => p.id === currentPlayerId)
    const nextIndex = (currentIndex + 1) % players.length
    const nextPlayerId = players[nextIndex].id

    // 全員がパスした場合は最初のプレイヤーが強制的にナポレオン
    if (nextIndex === 0) {
      onNapoleonSelect(players[0].id)
    } else {
      // 次のプレイヤーのターンに移行（実装は親コンポーネントで）
    }
  }

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow-lg">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Napoleon Declaration
        </h2>
        <p className="text-gray-600">
          {currentPlayer.name}, do you want to be Napoleon?
        </p>
      </div>

      {/* カード選択（オプション） */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          Select a card to call (optional):
        </h3>
        <p className="text-sm text-gray-600">
          Choose a card that you want your adjutant to have
        </p>

        <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
          {currentPlayer.hand.map((card) => (
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
          onClick={handleNapoleonDeclaration}
          className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg transition-colors"
        >
          Declare Napoleon
        </button>

        <button
          onClick={handlePass}
          className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors"
        >
          Pass
        </button>
      </div>

      {/* 説明 */}
      <div className="text-xs text-gray-500 text-center space-y-1">
        <p>As Napoleon, you need to win 8 or more tricks with your adjutant</p>
        <p>If you don't select a card, your adjutant will be chosen randomly</p>
      </div>
    </div>
  )
}
