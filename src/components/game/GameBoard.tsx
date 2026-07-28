'use client'
import { memo, useCallback, useMemo } from 'react'
import type { GameState, PlayedCard } from '@/types/game'
import { checkAdjutantRevealed, isSoloNapoleon } from '@/utils/gameUtils'
import { Card } from './Card'
import { PlayerAvatar } from './PlayerAvatar'

interface GameBoardProps {
  gameState: GameState
  currentPlayerId?: string | null
}

export const GameBoard = memo(function GameBoard({
  gameState,
  currentPlayerId,
}: GameBoardProps) {
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

  const isAdjutantRevealed = useMemo(
    () => checkAdjutantRevealed(gameState),
    [gameState]
  )

  // マスク済みなので、閲覧者に公開してよい場合のみ true になる
  const soloNapoleon = useMemo(() => isSoloNapoleon(gameState), [gameState])

  const getPlayerPosition = useCallback(
    (playerIndex: number) => {
      if (currentPlayerId) {
        const currentPlayerIndex = gameState.players.findIndex(
          (p) => p.id === currentPlayerId
        )
        if (currentPlayerIndex !== -1) {
          const relativeIndex = (playerIndex - currentPlayerIndex + 4) % 4
          const positions = ['bottom', 'left', 'top', 'right']
          return positions[relativeIndex]
        }
      }
      const positions = ['bottom', 'left', 'top', 'right']
      return positions[playerIndex]
    },
    [currentPlayerId, gameState.players]
  )

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

  const currentTurnPlayer = gameState.players[gameState.currentPlayerIndex]

  // Build seats by position
  const seatsByPosition = useMemo(() => {
    const seats: Record<
      string,
      { player: (typeof gameState.players)[0]; cardCount: number }
    > = {}
    gameState.players.forEach((player, index) => {
      const pos = getPlayerPosition(index)
      seats[pos] = { player, cardCount: player.hand.length }
    })
    return seats
  }, [gameState.players, getPlayerPosition])

  const seatPositionClasses: Record<string, string> = {
    top: 'absolute top-3 md:top-4 left-1/2 -translate-x-1/2',
    left: 'absolute left-4 md:left-6 top-1/2 -translate-y-1/2',
    right: 'absolute right-4 md:right-6 top-1/2 -translate-y-1/2',
    bottom: 'absolute bottom-3 md:bottom-4 left-1/2 -translate-x-1/2',
  }

  return (
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
      {/* Dashed inner border */}
      <div className="absolute inset-4 md:inset-6 border border-dashed border-white/10 rounded-[18px] pointer-events-none" />

      {/* Seat avatars */}
      {Object.entries(seatsByPosition).map(([pos, { player, cardCount }]) => (
        <div
          key={player.id}
          className={`${seatPositionClasses[pos]} flex flex-col items-center gap-1 z-10`}
        >
          <PlayerAvatar
            player={player}
            isCurrentUser={player.id === currentPlayerId}
            isCurrentTurn={currentTurnPlayer?.id === player.id}
            isAdjutantRevealed={isAdjutantRevealed}
            soloNapoleon={soloNapoleon}
            size="md"
          />
          <span
            className={`text-xs font-bold ${pos === 'bottom' ? 'text-yellow-300' : 'text-white/90'}`}
          >
            {player.id === currentPlayerId ? 'You' : player.name}
          </span>
          {pos !== 'bottom' && (
            <span className="text-[10px] text-white/50">{cardCount} cards</span>
          )}
        </div>
      ))}

      {/* Trick display area (center) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-60 h-48 md:w-80 md:h-56">
          {/* Trick halo */}
          <div className="absolute inset-[-10px] rounded-full bg-[radial-gradient(ellipse,rgba(255,255,255,.08),transparent_70%)]" />

          {/* Bottom card */}
          {cardsByPosition.bottom && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 -rotate-2">
              <Card card={cardsByPosition.bottom.card} size="small" />
            </div>
          )}
          {/* Top card */}
          {cardsByPosition.top && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 rotate-1">
              <Card card={cardsByPosition.top.card} size="small" />
            </div>
          )}
          {/* Left card */}
          {cardsByPosition.left && (
            <div className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 -rotate-[8deg]">
              <Card card={cardsByPosition.left.card} size="small" />
            </div>
          )}
          {/* Right card */}
          {cardsByPosition.right && (
            <div className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 rotate-[7deg]">
              <Card card={cardsByPosition.right.card} size="small" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
