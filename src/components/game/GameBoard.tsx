'use client'
import {
  getAllPlayersWonFaceCards,
  getGameProgress,
  getPlayerFaceCardCount,
} from '@/lib/scoring'
import type { GameState, PlayedCard } from '@/types/game'
import { Card } from './Card'

interface GameBoardProps {
  gameState: GameState
  currentPlayerId?: string | null
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

  // プレイヤー別の絵札獲得状況
  const playerFaceCards = gameState.players.map((player) => ({
    player,
    faceCards: getPlayerFaceCardCount(gameState, player.id),
    isCurrentUser: player.id === currentPlayerId, // 現在のプレイヤー（自分）かどうか
  }))

  // プレイヤー別の取得絵札詳細
  const allPlayersFaceCardDetails = getAllPlayersWonFaceCards(gameState)

  return (
    <div className="space-y-4">
      {/* メインゲームボード */}
      <div className="relative w-full max-w-4xl mx-auto h-96 bg-green-700 rounded-xl shadow-lg border-4 border-green-800">
        {/* ゲーム情報 */}
        <div className="absolute top-2 left-2 bg-gray-900 bg-opacity-95 text-white rounded-lg p-3 text-sm shadow-lg border border-gray-700">
          <div className="font-semibold mb-1">Game Progress</div>
          <div>Tricks: {progress.tricksPlayed}/12</div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-yellow-400 font-medium">Napoleon:</span>
            <span className="font-bold text-yellow-400">
              {progress.napoleonTeamFaceCards}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-blue-400 font-medium">Alliance:</span>
            <span className="font-bold text-blue-400">
              {progress.citizenTeamFaceCards}
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-300">
            Napoleon needs {progress.napoleonNeedsToWin} more
          </div>
          {/* 副官カード表示 */}
          {gameState.napoleonCard && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-xs text-gray-300 mb-1">Adjutant Card:</div>
              <div className="flex items-center gap-2">
                <Card card={gameState.napoleonCard} size="small" />
                <div className="text-xs">
                  <div className="font-medium text-white">
                    {gameState.napoleonCard.rank}
                  </div>
                  <div className="text-gray-400">
                    {gameState.napoleonCard.suit}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* プレイヤー別絵札獲得数表示 - 自分を強調 */}
        <div className="absolute top-2 right-2 bg-gray-900 bg-opacity-95 text-white rounded-lg p-3 text-xs shadow-lg border border-gray-700">
          <div className="font-semibold mb-2">Face Cards Won</div>
          {playerFaceCards.map((data) => {
            const roleColor = data.player.isNapoleon
              ? 'text-yellow-400'
              : data.player.isAdjutant
                ? 'text-green-400'
                : 'text-blue-400'

            // 副官が判明しているかどうかをチェック
            const isAdjutantRevealed =
              data.player.isAdjutant &&
              gameState.tricks.some((trick) =>
                trick.cards.some(
                  (playedCard) =>
                    gameState.napoleonCard &&
                    playedCard.card.id === gameState.napoleonCard.id
                )
              )

            return (
              <div
                key={data.player.id}
                className={`flex justify-between items-center mb-1 p-1 rounded ${
                  data.isCurrentUser
                    ? 'bg-blue-900 bg-opacity-50 border border-blue-400'
                    : ''
                }`}
              >
                <div className="flex items-center gap-1">
                  <span
                    className={`truncate max-w-16 ${
                      data.isCurrentUser ? 'font-bold' : ''
                    }`}
                  >
                    {data.player.name}
                    {data.isCurrentUser && ' (You)'}
                  </span>
                  {data.player.isNapoleon && (
                    <span className="px-1 bg-yellow-600 text-yellow-100 rounded text-xs">
                      N
                    </span>
                  )}
                  {isAdjutantRevealed && (
                    <span className="px-1 bg-green-600 text-green-100 rounded text-xs">
                      A
                    </span>
                  )}
                </div>
                <span
                  className={`font-bold ${roleColor} ${
                    data.isCurrentUser ? 'text-lg' : ''
                  }`}
                >
                  {data.faceCards}
                </span>
              </div>
            )
          })}
        </div>

        {/* 現在のプレイヤー表示 */}
        <div className="absolute bottom-2 right-2 bg-gray-900 bg-opacity-95 text-white rounded-lg p-3 text-sm shadow-lg border border-gray-700">
          <div className="font-semibold">Current Turn</div>
          <div>{currentPlayer.name}</div>
          {gameState.leadingSuit && (
            <div className="text-xs text-gray-300 mt-1">
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
                  {(() => {
                    const player = gameState.players.find(
                      (p) => p.id === cardsByPosition.bottom?.playerId
                    )
                    if (!player) return ''

                    const isAdjutantRevealed =
                      player.isAdjutant &&
                      gameState.tricks.some((trick) =>
                        trick.cards.some(
                          (playedCard) =>
                            gameState.napoleonCard &&
                            playedCard.card.id === gameState.napoleonCard.id
                        )
                      )

                    return (
                      <div className="flex items-center justify-center gap-1">
                        <span>{player.name}</span>
                        {player.isNapoleon && (
                          <span className="px-1 bg-yellow-600 text-yellow-100 rounded text-xs">
                            N
                          </span>
                        )}
                        {isAdjutantRevealed && (
                          <span className="px-1 bg-green-600 text-green-100 rounded text-xs">
                            A
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* 左 */}
            {cardsByPosition.left && (
              <div className="absolute left-0 top-1/2 transform -translate-y-1/2">
                <Card card={cardsByPosition.left.card} size="medium" />
                <div className="text-center text-xs text-white mt-1">
                  {(() => {
                    const player = gameState.players.find(
                      (p) => p.id === cardsByPosition.left?.playerId
                    )
                    if (!player) return ''

                    const isAdjutantRevealed =
                      player.isAdjutant &&
                      gameState.tricks.some((trick) =>
                        trick.cards.some(
                          (playedCard) =>
                            gameState.napoleonCard &&
                            playedCard.card.id === gameState.napoleonCard.id
                        )
                      )

                    return (
                      <div className="flex items-center justify-center gap-1">
                        <span>{player.name}</span>
                        {player.isNapoleon && (
                          <span className="px-1 bg-yellow-600 text-yellow-100 rounded text-xs">
                            N
                          </span>
                        )}
                        {isAdjutantRevealed && (
                          <span className="px-1 bg-green-600 text-green-100 rounded text-xs">
                            A
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* 上 */}
            {cardsByPosition.top && (
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
                <Card card={cardsByPosition.top.card} size="medium" />
                <div className="text-center text-xs text-white mt-1">
                  {(() => {
                    const player = gameState.players.find(
                      (p) => p.id === cardsByPosition.top?.playerId
                    )
                    if (!player) return ''

                    const isAdjutantRevealed =
                      player.isAdjutant &&
                      gameState.tricks.some((trick) =>
                        trick.cards.some(
                          (playedCard) =>
                            gameState.napoleonCard &&
                            playedCard.card.id === gameState.napoleonCard.id
                        )
                      )

                    return (
                      <div className="flex items-center justify-center gap-1">
                        <span>{player.name}</span>
                        {player.isNapoleon && (
                          <span className="px-1 bg-yellow-600 text-yellow-100 rounded text-xs">
                            N
                          </span>
                        )}
                        {isAdjutantRevealed && (
                          <span className="px-1 bg-green-600 text-green-100 rounded text-xs">
                            A
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* 右 */}
            {cardsByPosition.right && (
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
                <Card card={cardsByPosition.right.card} size="medium" />
                <div className="text-center text-xs text-white mt-1">
                  {(() => {
                    const player = gameState.players.find(
                      (p) => p.id === cardsByPosition.right?.playerId
                    )
                    if (!player) return ''

                    const isAdjutantRevealed =
                      player.isAdjutant &&
                      gameState.tricks.some((trick) =>
                        trick.cards.some(
                          (playedCard) =>
                            gameState.napoleonCard &&
                            playedCard.card.id === gameState.napoleonCard.id
                        )
                      )

                    return (
                      <div className="flex items-center justify-center gap-1">
                        <span>{player.name}</span>
                        {player.isNapoleon && (
                          <span className="px-1 bg-yellow-600 text-yellow-100 rounded text-xs">
                            N
                          </span>
                        )}
                        {isAdjutantRevealed && (
                          <span className="px-1 bg-green-600 text-green-100 rounded text-xs">
                            A
                          </span>
                        )}
                      </div>
                    )
                  })()}
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
          <div className="absolute bottom-2 left-2 bg-gray-900 bg-opacity-95 text-white rounded-lg p-2 text-xs shadow-lg border border-gray-700">
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

        {/* 最後のフェーズで全カードが出た場合のトリック結果表示 */}
        {currentTrick.cards.length === 4 && (
          <div className="absolute inset-x-0 bottom-20 flex justify-center">
            <div className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-lg font-bold shadow-lg">
              <div className="text-sm">Trick Complete!</div>
              <div className="text-xs">Determining winner...</div>
            </div>
          </div>
        )}
      </div>

      {/* プレイヤー別取得絵札表示 */}
      <div className="w-full max-w-4xl mx-auto">
        <h3 className="text-lg font-semibold text-center mb-4 text-gray-800">
          取得した絵札 (Face Cards Won)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {allPlayersFaceCardDetails.map((playerData) => {
            const isCurrentUser = playerData.player.id === currentPlayerId
            const roleColor = playerData.player.isNapoleon
              ? 'text-yellow-600'
              : playerData.player.isAdjutant
                ? 'text-green-600'
                : 'text-blue-600'

            // 副官が判明しているかどうかをチェック
            const isAdjutantRevealed =
              playerData.player.isAdjutant &&
              gameState.tricks.some((trick) =>
                trick.cards.some(
                  (playedCard) =>
                    gameState.napoleonCard &&
                    playedCard.card.id === gameState.napoleonCard.id
                )
              )

            return (
              <div
                key={playerData.player.id}
                className={`border rounded-lg p-3 bg-white ${
                  isCurrentUser
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h4
                      className={`font-semibold ${roleColor} ${
                        isCurrentUser ? 'font-bold' : ''
                      }`}
                    >
                      {playerData.player.name}
                      {isCurrentUser && ' (You)'}
                    </h4>
                    {playerData.player.isNapoleon && (
                      <span className="px-1 py-0.5 bg-yellow-200 text-yellow-700 rounded text-xs">
                        N
                      </span>
                    )}
                    {isAdjutantRevealed && (
                      <span className="px-1 py-0.5 bg-green-200 text-green-700 rounded text-xs">
                        A
                      </span>
                    )}
                  </div>
                  <div className={`text-sm font-bold ${roleColor}`}>
                    {playerData.faceCards.length}枚
                  </div>
                </div>

                {playerData.faceCards.length > 0 ? (
                  <div className="grid grid-cols-4 gap-1">
                    {playerData.faceCards.map((card, index) => (
                      <Card
                        key={`${card.suit}-${card.rank}-${index}`}
                        card={card}
                        size="small"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-2 text-xs">
                    まだ絵札なし
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
