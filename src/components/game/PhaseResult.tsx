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
    return `${suitSymbols[card.suit]}${card.rank}`
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
        <h3 className="text-xl font-bold text-center">Phase Complete!</h3>

        {/* 最後のプレイヤーが出したカード */}
        <div className="text-center bg-gray-50 p-3 rounded">
          <div className="text-sm text-gray-600">Last card played:</div>
          <div className="text-lg font-bold">
            {lastPlayer?.name} played {getCardDisplay(lastCard)}
          </div>
        </div>

        {/* 勝者 */}
        <div className="text-center bg-blue-50 p-3 rounded">
          <div className="text-sm text-gray-600">Phase winner:</div>
          <div className="text-lg font-bold text-blue-600">
            {winner?.name}
            {winner?.isNapoleon && ' (Napoleon)'}
            {winner?.isAdjutant && ' (Adjutant)'}
          </div>
        </div>

        {/* 獲得した絵札 */}
        <div className="bg-green-50 p-3 rounded">
          <div className="text-sm text-gray-600 mb-2">Face cards won:</div>
          {faceCardsInPhase.length > 0 ? (
            <div className="space-y-1">
              {faceCardsInPhase.map((pc) => (
                <div key={pc.card.id} className="text-sm font-mono">
                  {getCardDisplay(pc)}
                </div>
              ))}
              <div className="text-sm font-bold text-green-600 mt-2">
                Total: {faceCardsInPhase.length} face card
                {faceCardsInPhase.length > 1 ? 's' : ''}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              No face cards in this phase
            </div>
          )}
        </div>

        {/* 続行ボタン */}
        <button
          type="button"
          onClick={onContinue}
          className="w-full py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
