'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { GameBoard } from '@/components/game/GameBoard'
import { GameStatus } from '@/components/game/GameStatus'
import { NapoleonSelector } from '@/components/game/NapoleonSelector'
import { PlayerHand } from '@/components/game/PlayerHand'
import { useGameState } from '@/hooks/useGameState'
import { calculateGameResult } from '@/lib/scoring'
import type { Card as CardType } from '@/types/game'

export default function GamePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const gameId = params.gameId as string
  const [currentPlayerId, _setCurrentPlayerId] = useState<string>('player_1') // 実際の実装では認証から取得
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  // URLクエリパラメータからプレイヤー名を取得 (Quick Start用)
  const playersParam = searchParams.get('players')
  const playerNames = playersParam ? playersParam.split(',') : undefined

  const { gameState, loading, error, actions, utils } = useGameState(
    gameId,
    playerNames
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading game...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center bg-red-50 p-8 rounded-lg">
          <div className="text-red-600 text-xl font-semibold mb-2">Error</div>
          <p className="text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-gray-600">Game not found</p>
      </div>
    )
  }

  const currentPlayer = gameState.players.find((p) => p.id === currentPlayerId)
  const isCurrentTurn = utils.getCurrentPlayer()?.id === currentPlayerId
  const playableCards = utils.getPlayableCards(currentPlayerId)

  const handleCardClick = (cardId: string) => {
    if (!isCurrentTurn || !playableCards.includes(cardId)) return

    setSelectedCardId(selectedCardId === cardId ? null : cardId)
  }

  const handlePlayCard = () => {
    if (!selectedCardId || !isCurrentTurn) return

    actions.playCard(currentPlayerId, selectedCardId)
    setSelectedCardId(null)
  }

  const handleNapoleonSelect = (playerId: string, napoleonCard?: CardType) => {
    actions.setNapoleon(playerId, napoleonCard)
  }

  // ゲーム終了時の結果表示
  if (gameState.phase === 'finished') {
    const result = calculateGameResult(gameState)

    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h1 className="text-3xl font-bold mb-6">Game Finished!</h1>

            <div className="mb-6">
              <div
                className={`text-2xl font-bold mb-2 ${
                  result.napoleonWon ? 'text-yellow-600' : 'text-blue-600'
                }`}
              >
                {result.napoleonWon ? 'Napoleon Team Wins!' : 'Citizens Win!'}
              </div>
              <p className="text-gray-600">
                Napoleon team won {result.tricksWon} out of 12 tricks
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {result.scores.map((score, _index) => {
                const player = gameState.players.find(
                  (p) => p.id === score.playerId
                )
                return (
                  <div
                    key={score.playerId}
                    className={`p-4 rounded-lg ${
                      score.isWinner ? 'bg-green-100' : 'bg-red-100'
                    }`}
                  >
                    <div className="font-semibold">{player?.name}</div>
                    <div className="text-sm text-gray-600">
                      {player?.isNapoleon && 'Napoleon'}
                      {player?.isAdjutant && 'Adjutant'}
                      {!player?.isNapoleon && !player?.isAdjutant && 'Citizen'}
                    </div>
                    <div
                      className={`text-lg font-bold ${
                        score.points > 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {score.points > 0 ? '+' : ''}
                      {score.points} points
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                window.location.href = '/'
              }}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-4">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-center mb-6">Napoleon Game</h1>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* メインゲームエリア */}
          <div className="lg:col-span-3 space-y-6">
            {/* ナポレオン選択フェーズ */}
            {gameState.phase === 'napoleon' && (
              <NapoleonSelector
                players={gameState.players}
                currentPlayerId={currentPlayerId}
                onNapoleonSelect={handleNapoleonSelect}
              />
            )}

            {/* ゲームボード */}
            {gameState.phase === 'playing' && (
              <GameBoard
                gameState={gameState}
                currentPlayerId={currentPlayerId}
              />
            )}

            {/* プレイヤーの手札 */}
            {currentPlayer && (
              <div className="space-y-4">
                <PlayerHand
                  player={currentPlayer}
                  isCurrentPlayer={isCurrentTurn}
                  onCardClick={handleCardClick}
                  selectedCardId={selectedCardId || undefined}
                  playableCardIds={playableCards}
                  showCards={true}
                />

                {/* プレイボタン */}
                {isCurrentTurn && selectedCardId && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handlePlayCard}
                      className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
                    >
                      Play Selected Card
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 他のプレイヤーの手札（簡略表示） */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {gameState.players
                .filter((p) => p.id !== currentPlayerId)
                .map((player) => (
                  <div
                    key={player.id}
                    className="bg-white p-4 rounded-lg shadow"
                  >
                    <PlayerHand player={player} showCards={false} />
                  </div>
                ))}
            </div>
          </div>

          {/* サイドバー */}
          <div className="lg:col-span-1">
            <GameStatus
              gameState={gameState}
              currentPlayerId={currentPlayerId}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
