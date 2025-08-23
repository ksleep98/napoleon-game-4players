'use client'

import { GameState, PlayedCard } from '@/types/game'
import { Card } from './Card'
import { getGameProgress } from '@/lib/scoring'

interface GameBoardProps {
  gameState: GameState
  currentPlayerId?: string
}

export function GameBoard({ gameState, currentPlayerId }: GameBoardProps) {
  const currentTrick = gameState.currentTrick
  const progress = getGameProgress(gameState)

  // プレイヤーの位置を計算（4人のプレイヤーを上下左右に配置）
  const getPlayerPosition = (playerIndex: number) => {
    const positions = [
      'bottom', // プレイヤー1（自分）
      'left', // プレイヤー2
      'top', // プレイヤー3
      'right', // プレイヤー4
    ]
    return positions[playerIndex]
  }

  // 現在のトリックでプレイされたカードを位置別に整理
  const cardsByPosition: Record<string, PlayedCard | null> = {
    bottom: null,
    left: null,
    top: null,
    right: null,
  }

  currentTrick.cards.forEach((playedCard) => {
    const playerIndex = gameState.players.findIndex(
      (p) => p.id === playedCard.playerId
    )
    const position = getPlayerPosition(playerIndex)
    cardsByPosition[position] = playedCard
  })

  const currentPlayer = gameState.players[gameState.currentPlayerIndex]

  return (
    <div className="relative w-full max-w-4xl mx-auto h-96 bg-green-700 rounded-xl shadow-lg border-4 border-green-800">
      {/* ゲーム情報 */}
      <div className="absolute top-2 left-2 bg-white bg-opacity-90 rounded-lg p-3 text-sm">
        <div className="font-semibold mb-1">Game Progress</div>
        <div>Tricks: {progress.tricksPlayed}/12</div>
        <div>Napoleon: {progress.napoleonTeamTricks}</div>
        <div>Citizens: {progress.citizenTeamTricks}</div>
        <div className="mt-1 text-xs text-gray-600">
          Napoleon needs {progress.napoleonNeedsToWin} more
        </div>
      </div>

      {/* 現在のプレイヤー表示 */}
      <div className="absolute top-2 right-2 bg-white bg-opacity-90 rounded-lg p-3 text-sm">
        <div className="font-semibold">Current Turn</div>
        <div>{currentPlayer.name}</div>
        {gameState.leadingSuit && (
          <div className="text-xs text-gray-600 mt-1">
            Lead suit: {gameState.leadingSuit}
          </div>
        )}
      </div>

      {/* トリック表示エリア（中央） */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-48 h-48">
          {/* 下（自分） */}
          {cardsByPosition.bottom && (
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2">
              <Card card={cardsByPosition.bottom.card} size="medium" />
              <div className="text-center text-xs text-white mt-1">
                {
                  gameState.players.find(
                    (p) => p.id === cardsByPosition.bottom?.playerId
                  )?.name
                }
              </div>
            </div>
          )}

          {/* 左 */}
          {cardsByPosition.left && (
            <div className="absolute left-0 top-1/2 transform -translate-y-1/2">
              <Card card={cardsByPosition.left.card} size="medium" />
              <div className="text-center text-xs text-white mt-1">
                {
                  gameState.players.find(
                    (p) => p.id === cardsByPosition.left?.playerId
                  )?.name
                }
              </div>
            </div>
          )}

          {/* 上 */}
          {cardsByPosition.top && (
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
              <Card card={cardsByPosition.top.card} size="medium" />
              <div className="text-center text-xs text-white mt-1">
                {
                  gameState.players.find(
                    (p) => p.id === cardsByPosition.top?.playerId
                  )?.name
                }
              </div>
            </div>
          )}

          {/* 右 */}
          {cardsByPosition.right && (
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
              <Card card={cardsByPosition.right.card} size="medium" />
              <div className="text-center text-xs text-white mt-1">
                {
                  gameState.players.find(
                    (p) => p.id === cardsByPosition.right?.playerId
                  )?.name
                }
              </div>
            </div>
          )}

          {/* 中央にトリック番号表示 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white bg-opacity-80 rounded-full w-16 h-16 flex items-center justify-center">
              <div className="text-center">
                <div className="font-bold text-lg">
                  {progress.tricksPlayed + 1}
                </div>
                <div className="text-xs">Trick</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 最後に勝ったトリック表示 */}
      {gameState.tricks.length > 0 && (
        <div className="absolute bottom-2 left-2 bg-white bg-opacity-90 rounded-lg p-2 text-xs">
          <div className="font-semibold">Last Trick Winner:</div>
          <div>
            {
              gameState.players.find(
                (p) =>
                  p.id ===
                  gameState.tricks[gameState.tricks.length - 1].winnerPlayerId
              )?.name
            }
          </div>
        </div>
      )}
    </div>
  )
}
