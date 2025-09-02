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

  // プレイヤーのアイコン表示ロジックを統一化
  const getPlayerIcons = (
    player: { isNapoleon: boolean; isAdjutant: boolean },
    playedCard?: PlayedCard
  ) => {
    const icons = []

    // ナポレオンアイコン
    if (player.isNapoleon) {
      icons.push(
        <span
          key="napoleon"
          className="px-1 bg-yellow-600 text-yellow-100 rounded text-xs"
        >
          N
        </span>
      )
    }

    // 通常の副官アイコン（副官プレイヤーが判明している場合）
    const isAdjutantRevealed =
      player.isAdjutant &&
      gameState.tricks.some((trick) =>
        trick.cards.some(
          (playedCard) =>
            gameState.napoleonCard &&
            playedCard.card.id === gameState.napoleonCard.id
        )
      )

    if (isAdjutantRevealed) {
      icons.push(
        <span
          key="adjutant"
          className="px-1 bg-green-600 text-green-100 rounded text-xs"
        >
          A
        </span>
      )
    }

    // 新機能：ナポレオンが隠しカードの副官カードを出した場合の副官アイコン
    if (playedCard?.revealsAdjutant && player.isNapoleon) {
      icons.push(
        <span
          key="adjutant-reveal"
          className="px-1 bg-green-600 text-green-100 rounded text-xs"
        >
          A
        </span>
      )
    }

    return icons
  }

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
                  {getPlayerIcons(data.player)}
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

                    return (
                      <div className="flex items-center justify-center gap-1">
                        <span>{player.name}</span>
                        {getPlayerIcons(player, cardsByPosition.bottom)}
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

                    return (
                      <div className="flex items-center justify-center gap-1">
                        <span>{player.name}</span>
                        {getPlayerIcons(player, cardsByPosition.left)}
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

                    return (
                      <div className="flex items-center justify-center gap-1">
                        <span>{player.name}</span>
                        {getPlayerIcons(player, cardsByPosition.top)}
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

                    return (
                      <div className="flex items-center justify-center gap-1">
                        <span>{player.name}</span>
                        {getPlayerIcons(player, cardsByPosition.right)}
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 現在のプレイヤーと手番情報 */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 bg-opacity-95 text-white rounded-lg p-2 text-sm shadow-lg border border-gray-700">
          <div className="flex items-center gap-2">
            <span>Turn:</span>
            <span className="font-bold text-blue-400">
              {currentPlayer?.name}
            </span>
            {currentPlayer?.isNapoleon && (
              <span className="px-1 bg-yellow-600 text-yellow-100 rounded text-xs">
                N
              </span>
            )}
            {currentPlayer?.isAdjutant && (
              <span className="px-1 bg-green-600 text-green-100 rounded text-xs">
                A
              </span>
            )}
          </div>
        </div>
      </div>

      {/* プレイヤー獲得絵札詳細 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {allPlayersFaceCardDetails.map((playerData) => (
          <div
            key={playerData.player.id}
            className="bg-white p-4 rounded-lg shadow border"
          >
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-semibold text-gray-800">
                {playerData.player.name}
              </h3>
              {playerData.player.isNapoleon && (
                <span className="px-2 py-1 bg-yellow-600 text-yellow-100 rounded text-xs">
                  Napoleon
                </span>
              )}
              {(() => {
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
                  isAdjutantRevealed && (
                    <span className="px-2 py-1 bg-green-600 text-green-100 rounded text-xs">
                      Adjutant
                    </span>
                  )
                )
              })()}
            </div>

            <div className="text-sm text-gray-600 mb-2">
              Face Cards Won: {playerData.faceCards.length}
            </div>

            {playerData.faceCards.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {playerData.faceCards.map((card, index) => (
                  <Card key={`${card.id}-${index}`} card={card} size="tiny" />
                ))}
              </div>
            ) : (
              <div className="text-gray-400 text-sm">No face cards won yet</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
