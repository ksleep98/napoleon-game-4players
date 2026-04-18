'use client'
import { memo, useCallback, useMemo } from 'react'
import { getGameProgress, getPlayerFaceCardCount } from '@/lib/scoring'
import type { GameState, PlayedCard } from '@/types/game'
import { Card } from './Card'

interface GameBoardProps {
  gameState: GameState
  currentPlayerId?: string | null
}

// 🚀 React.memoで不要な再レンダリングを防止（10-20ms削減）
export const GameBoard = memo(function GameBoard({
  gameState,
  currentPlayerId,
}: GameBoardProps) {
  // 🚀 トリック計算をメモ化
  const currentTrick = useMemo(
    () =>
      gameState.showingTrickResult && gameState.lastCompletedTrick
        ? gameState.lastCompletedTrick
        : gameState.currentTrick,
    [
      gameState.showingTrickResult,
      gameState.lastCompletedTrick,
      gameState.currentTrick,
    ]
  )

  // 🚀 プログレス計算をメモ化
  const progress = useMemo(() => getGameProgress(gameState), [gameState])

  // 🚀 プレイヤー位置計算をメモ化
  const getPlayerPosition = useCallback(
    (playerIndex: number) => {
      // currentPlayerIdが指定されている場合は、そのプレイヤーをbottomに配置
      if (currentPlayerId) {
        const currentPlayerIndex = gameState.players.findIndex(
          (p) => p.id === currentPlayerId
        )

        if (currentPlayerIndex !== -1) {
          // 自分を基準に相対的な位置を計算（時計回り）
          const relativeIndex = (playerIndex - currentPlayerIndex + 4) % 4
          const positions = ['bottom', 'left', 'top', 'right']
          return positions[relativeIndex]
        }
      }

      // currentPlayerIdが指定されていない場合は、従来通り
      const positions = [
        'bottom', // プレイヤー1（自分）
        'left', // プレイヤー2
        'top', // プレイヤー3
        'right', // プレイヤー4
      ]
      return positions[playerIndex]
    },
    [currentPlayerId, gameState.players]
  )

  // 🚀 カード配置計算をメモ化
  const cardsByPosition = useMemo(() => {
    const positions: Record<string, PlayedCard | null> = {
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
      positions[position] = playedCard
    })

    return positions
  }, [currentTrick.cards, gameState.players, getPlayerPosition])

  const currentPlayer = gameState.players[gameState.currentPlayerIndex]

  // 🚀 絵札獲得状況をメモ化
  const playerFaceCards = useMemo(
    () =>
      gameState.players.map((player) => ({
        player,
        faceCards: getPlayerFaceCardCount(gameState, player.id),
        isCurrentUser: player.id === currentPlayerId, // 現在のプレイヤー（自分）かどうか
      })),
    [gameState, currentPlayerId]
  )

  // プレイヤーのアイコン表示ロジックを統一化
  const getPlayerIcons = (
    player: { id: string; isNapoleon: boolean; isAdjutant: boolean },
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

    // 副官アイコン表示条件：自分が副官 OR 副官が判明している
    const isCurrentUser = player.id === currentPlayerId
    const isAdjutantRevealed =
      gameState.tricks.some((trick) =>
        trick.cards.some(
          (playedCard) =>
            gameState.napoleonCard &&
            playedCard.card.id === gameState.napoleonCard.id
        )
      ) ||
      gameState.tricks.some((trick) =>
        trick.cards.some((playedCard) => playedCard.revealsAdjutant)
      ) ||
      gameState.currentTrick.cards.some(
        (playedCard) => playedCard.revealsAdjutant
      )

    if (player.isAdjutant && (isCurrentUser || isAdjutantRevealed)) {
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
    <div className="space-y-2 md:space-y-4">
      {/* メインゲームボード */}
      <div
        className="relative w-full max-w-6xl mx-auto aspect-video
          rounded-[22px] border border-white/10 overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at center, #1f7a4a 0%, #14532d 80%)',
          boxShadow:
            'inset 0 0 120px rgba(0,0,0,.45), 0 30px 60px -20px rgba(0,0,0,.6)',
        }}
      >
        {/* HUD panels moved to TopHUD component */}

        {/* 下（自分） - 親コンテナに対して直接配置 */}
        {cardsByPosition.bottom && (
          <div className="absolute bottom-8 md:bottom-14 left-1/2 transform -translate-x-1/2 flex flex-col items-center z-10">
            <Card card={cardsByPosition.bottom.card} size="small" />
            <div className="text-center text-[0.6rem] md:text-xs text-white mt-1 md:mt-4 bg-black bg-opacity-60 rounded px-1 md:px-2 py-0.5 md:py-1">
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

        {/* トリック表示エリア（中央） */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-60 h-60 md:w-96 md:h-96">
            {/* 左 */}
            {cardsByPosition.left && (
              <div className="absolute left-4 md:left-12 top-1/2 transform translate-y-2 md:translate-y-4 flex flex-col items-center">
                <Card card={cardsByPosition.left.card} size="small" />
                <div className="text-center text-[0.6rem] md:text-xs text-white mt-1 md:mt-4 bg-black bg-opacity-60 rounded px-1 md:px-2 py-0.5 md:py-1">
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
              <div className="absolute top-8 md:top-16 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
                <div className="text-center text-[0.6rem] md:text-xs text-white mb-1 md:mb-4 bg-black bg-opacity-60 rounded px-1 md:px-2 py-0.5 md:py-1">
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
                <Card card={cardsByPosition.top.card} size="small" />
              </div>
            )}

            {/* 右 */}
            {cardsByPosition.right && (
              <div className="absolute right-4 md:right-12 top-1/2 transform translate-y-2 md:translate-y-4 flex flex-col items-center">
                <Card card={cardsByPosition.right.card} size="small" />
                <div className="text-center text-[0.6rem] md:text-xs text-white mt-1 md:mt-4 bg-black bg-opacity-60 rounded px-1 md:px-2 py-0.5 md:py-1">
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
        <div className="absolute bottom-1 md:bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 bg-opacity-95 text-white rounded-lg p-1 md:p-2 text-[0.65rem] md:text-sm shadow-lg border border-gray-700">
          <div className="flex items-center gap-1 md:gap-2">
            <span>Turn:</span>
            <span className="font-bold text-blue-400 truncate max-w-20 md:max-w-none">
              {currentPlayer?.name}
            </span>
            {currentPlayer?.isNapoleon && (
              <span className="px-1 bg-yellow-600 text-yellow-100 rounded text-xs">
                N
              </span>
            )}
            {currentPlayer?.isAdjutant &&
              (currentPlayer.id === currentPlayerId ||
                gameState.tricks.some((trick) =>
                  trick.cards.some(
                    (playedCard) =>
                      gameState.napoleonCard &&
                      playedCard.card.id === gameState.napoleonCard.id
                  )
                ) ||
                gameState.tricks.some((trick) =>
                  trick.cards.some((playedCard) => playedCard.revealsAdjutant)
                ) ||
                gameState.currentTrick.cards.some(
                  (playedCard) => playedCard.revealsAdjutant
                )) && (
                <span className="px-1 bg-green-600 text-green-100 rounded text-xs">
                  A
                </span>
              )}
          </div>
        </div>
      </div>
    </div>
  )
})
