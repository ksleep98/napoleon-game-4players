'use client'

import { isFaceCard } from '@/lib/constants'
import type { Phase, PlayedCard } from '@/types/game'

interface PhaseResultProps {
  phase: Phase
  players: Array<{
    id: string
    name: string
    isNapoleon?: boolean
    isAdjutant?: boolean
  }>
  onContinue: () => void
}

export function PhaseResult({ phase, players, onContinue }: PhaseResultProps) {
  if (!phase.completed || !phase.winnerPlayerId) {
    return null
  }

  const winner = players.find((p) => p.id === phase.winnerPlayerId)
  const faceCardsInPhase = phase.cards.filter((pc) => isFaceCard(pc.card))
  const lastCard = phase.cards[phase.cards.length - 1]
  const lastPlayer = players.find((p) => p.id === lastCard.playerId)

  const getCardDisplay = (playedCard: PlayedCard) => {
    const card = playedCard.card
    const suitSymbols = {
      spades: '♠',
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
    }
    const suitColors = {
      spades: 'text-gray-800',
      hearts: 'text-red-500',
      diamonds: 'text-red-500',
      clubs: 'text-gray-800',
    }
    return {
      text: `${suitSymbols[card.suit]}${card.rank}`,
      color: suitColors[card.suit],
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 space-y-4 animate-fadeIn">
        <h3 className="text-xl font-bold text-center text-gray-800">
          🏁 Trick Complete!
        </h3>

        {/* 全プレイヤーが出したカード表示 */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600 mb-3 text-center">
            Cards played in this trick:
          </div>
          <div className="space-y-2">
            {phase.cards.map((playedCard) => {
              const player = players.find((p) => p.id === playedCard.playerId)
              const cardDisplay = getCardDisplay(playedCard)
              const isWinningCard = playedCard.playerId === phase.winnerPlayerId

              return (
                <div
                  key={playedCard.card.id}
                  className={`flex justify-between items-center p-2 rounded ${
                    isWinningCard
                      ? 'bg-blue-100 border border-blue-300'
                      : 'bg-white'
                  }`}
                >
                  <span className="font-medium">{player?.name}</span>
                  <span
                    className={`font-bold text-lg ${cardDisplay.color} ${
                      isWinningCard ? 'animate-pulse' : ''
                    }`}
                  >
                    {cardDisplay.text}
                    {isWinningCard && ' 👑'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 最後のプレイヤーが出したカード（特別強調） */}
        {phase.cards.length === 4 && (
          <div className="text-center bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
            <div className="text-sm text-yellow-700 mb-1">
              Final card played:
            </div>
            <div className="text-lg font-bold">
              <span>{lastPlayer?.name}</span>
              <span className="mx-2">→</span>
              <span className={getCardDisplay(lastCard).color}>
                {getCardDisplay(lastCard).text}
              </span>
            </div>
          </div>
        )}

        {/* 勝者 */}
        <div className="text-center bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <div className="text-sm text-blue-600 mb-2">🏆 Trick Winner:</div>
          <div className="text-xl font-bold text-blue-700">
            {winner?.name}
            {winner?.isNapoleon && ' 👑 (Napoleon)'}
            {winner?.isAdjutant && ' ⚔️ (Adjutant)'}
          </div>
        </div>

        {/* 獲得した絵札 */}
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
          <div className="text-sm text-green-600 mb-2">
            💎 Face cards won in this trick:
          </div>
          {faceCardsInPhase.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {faceCardsInPhase.map((pc) => {
                  const cardDisplay = getCardDisplay(pc)
                  return (
                    <div
                      key={pc.card.id}
                      className="bg-white px-3 py-1 rounded-full border border-green-300"
                    >
                      <span className={`font-bold ${cardDisplay.color}`}>
                        {cardDisplay.text}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="text-center">
                <div className="inline-block bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                  {faceCardsInPhase.length} face card
                  {faceCardsInPhase.length > 1 ? 's' : ''}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 text-sm">
              No face cards in this trick
            </div>
          )}
        </div>

        {/* 続行ボタン */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onContinue}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-lg"
          >
            ✨ Continue Game
          </button>
        </div>
      </div>
    </div>
  )
}
