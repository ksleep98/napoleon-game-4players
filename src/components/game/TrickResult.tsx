'use client'

import { useState } from 'react'
import { isFaceCard, SUIT_DISPLAY_COLORS, SUIT_SYMBOLS } from '@/lib/constants'
import type { PlayedCard, Suit, Trick } from '@/types/game'
import { showsAdjutantBadge } from '@/utils/gameUtils'

interface TrickResultProps {
  trick: Trick
  players: Array<{
    id: string
    name: string
    isNapoleon?: boolean
    isAdjutant?: boolean
  }>
  onContinue: () => void
  /** 副官指定カードが場に出て正体が公開済みかどうか */
  isAdjutantRevealed?: boolean
  /** 閲覧者のプレイヤーID（自分の正体は常に見える） */
  currentPlayerId?: string | null
  /** 一人ナポレオン（公開済みならナポレオンを副官としても表示する） */
  soloNapoleon?: boolean
}

export function TrickResult({
  trick,
  players,
  onContinue,
  isAdjutantRevealed = false,
  currentPlayerId,
  soloNapoleon = false,
}: TrickResultProps) {
  const [isClosing, setIsClosing] = useState(false)

  if (!trick.completed || !trick.winnerPlayerId) {
    return null
  }

  const winner = players.find((p) => p.id === trick.winnerPlayerId)
  const faceCardsInPhase = trick.cards.filter((pc) => isFaceCard(pc.card))

  // 副官の正体は公開されるまで隠す（自分自身の正体は常に表示）。
  // 一人ナポレオンでは公開後、勝者がナポレオンなら 👑 と ⚔️ の両方が付く
  const showWinnerAdjutantBadge = winner
    ? showsAdjutantBadge({
        player: {
          isNapoleon: Boolean(winner.isNapoleon),
          isAdjutant: Boolean(winner.isAdjutant),
        },
        soloNapoleon,
        isAdjutantRevealed,
        isCurrentUser: winner.id === currentPlayerId,
      })
    : false

  const getCardDisplay = (playedCard: PlayedCard) => {
    const card = playedCard.card
    return {
      text: `${SUIT_SYMBOLS[card.suit as Suit]}${card.rank}`,
      color: SUIT_DISPLAY_COLORS[card.suit as Suit],
    }
  }

  const handleContinue = () => {
    if (isClosing) return // 既に閉じ中の場合は何もしない

    setIsClosing(true)
    onContinue()

    // 少し遅延を入れてから状態をリセット（次回のモーダル表示のため）
    setTimeout(() => {
      setIsClosing(false)
    }, 500)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full md:w-96 mx-4">
      <div className="bg-white bg-opacity-90 rounded-lg p-4 md:p-5 space-y-3 animate-fadeIn shadow-2xl border-2 border-blue-300">
        {/* ヘッダー：勝者と絵札数を1行で表示 */}
        <div className="text-center bg-gradient-to-r from-blue-50 to-green-50 bg-opacity-80 border border-blue-200 p-2 md:p-3 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-xs text-blue-600 mb-1">🏆 Winner</div>
              <div className="text-sm md:text-base font-bold text-blue-700 truncate">
                {winner?.name}
                {winner?.isNapoleon && ' 👑'}
                {showWinnerAdjutantBadge && ' ⚔️'}
              </div>
            </div>
            <div className="flex-shrink-0 ml-2">
              <div className="text-xs text-green-600 mb-1">💎 Face Cards</div>
              <div className="text-lg md:text-xl font-bold text-green-700">
                {faceCardsInPhase.length}
              </div>
            </div>
          </div>
        </div>

        {/* 全プレイヤーが出したカード表示（コンパクト） */}
        <div className="bg-gray-50 bg-opacity-70 p-2 md:p-3 rounded-lg">
          <div className="space-y-1">
            {trick.cards.map((playedCard) => {
              const player = players.find((p) => p.id === playedCard.playerId)
              const cardDisplay = getCardDisplay(playedCard)
              const isWinningCard = playedCard.playerId === trick.winnerPlayerId

              return (
                <div
                  key={playedCard.card.id}
                  className={`flex justify-between items-center px-2 py-1.5 rounded ${
                    isWinningCard
                      ? 'bg-blue-100 bg-opacity-80 border border-blue-300'
                      : 'bg-white bg-opacity-60'
                  }`}
                >
                  <span className="text-sm font-medium truncate max-w-[120px]">
                    {player?.name}
                  </span>
                  <span
                    className={`font-bold text-base md:text-lg ${cardDisplay.color} ${
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

        {/* 続行ボタン（コンパクト） */}
        <button
          type="button"
          onClick={handleContinue}
          disabled={isClosing}
          className={`w-full py-2.5 font-bold rounded-lg transition-colors shadow-lg text-sm md:text-base ${
            isClosing
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isClosing ? '⏳ Closing...' : '✨ Continue Game'}
        </button>
      </div>
    </div>
  )
}
