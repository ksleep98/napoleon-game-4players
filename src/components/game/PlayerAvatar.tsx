'use client'

import { memo } from 'react'
import type { Player } from '@/types/game'

interface PlayerAvatarProps {
  player: Player
  isCurrentUser?: boolean
  isCurrentTurn?: boolean
  isAdjutantRevealed?: boolean
  size?: 'sm' | 'md'
}

export const PlayerAvatar = memo(function PlayerAvatar({
  player,
  isCurrentUser = false,
  isCurrentTurn = false,
  isAdjutantRevealed = false,
  size = 'md',
}: PlayerAvatarProps) {
  const showAdjutant =
    player.isAdjutant && (isCurrentUser || isAdjutantRevealed)

  const borderColor = player.isNapoleon
    ? 'border-yellow-500 shadow-[0_0_0_2px_rgba(234,179,8,0.25)]'
    : showAdjutant
      ? 'border-green-600'
      : 'border-blue-500'

  const sizeClasses =
    size === 'sm'
      ? 'w-9 h-9 text-xs border-2'
      : 'w-[52px] h-[52px] text-[15px] border-[3px]'

  const initial = player.name.charAt(0).toUpperCase()

  return (
    <div className="relative inline-flex flex-col items-center">
      {/* Napoleon crown */}
      {player.isNapoleon && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-base z-10">
          👑
        </span>
      )}

      <div
        className={`${sizeClasses} ${borderColor} rounded-full flex items-center justify-center bg-gray-800 text-white font-bold relative ${isCurrentUser ? 'outline-2 outline-dashed outline-white outline-offset-[3px]' : ''}`}
      >
        {initial}

        {/* Turn pulse ring */}
        {isCurrentTurn && (
          <span className="absolute inset-[-6px] rounded-full border-2 border-white animate-rdPulse pointer-events-none" />
        )}
      </div>
    </div>
  )
})
