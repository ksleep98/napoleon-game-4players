'use client'

import { memo } from 'react'
import { SOLO_NAPOLEON_LABELS } from '@/lib/constants'
import type { Player } from '@/types/game'
import { showsAdjutantBadge } from '@/utils/gameUtils'

interface PlayerAvatarProps {
  player: Player
  isCurrentUser?: boolean
  isCurrentTurn?: boolean
  isAdjutantRevealed?: boolean
  /** 一人ナポレオン（公開済みならナポレオンを副官としても表示する） */
  soloNapoleon?: boolean
  size?: 'sm' | 'md'
}

export const PlayerAvatar = memo(function PlayerAvatar({
  player,
  isCurrentUser = false,
  isCurrentTurn = false,
  isAdjutantRevealed = false,
  soloNapoleon = false,
  size = 'md',
}: PlayerAvatarProps) {
  const showAdjutant = showsAdjutantBadge({
    player,
    soloNapoleon,
    isAdjutantRevealed,
    isCurrentUser,
  })

  // ナポレオンと副官を兼ねる（一人ナポレオン）場合、枠線は片方の役職しか
  // 表せない（下の borderColor はナポレオンを優先する）。そのため兼任時だけ
  // 明示的な副官マークを足す。通常ゲームの副官は従来どおり緑枠のみで、
  // 表示は一切変わらない。
  const showDualRoleMark = player.isNapoleon && showAdjutant

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

        {/* 一人ナポレオン: 王冠は上部中央のまま、副官マークを右下に添える。
            王冠の位置を動かさないので通常ゲームの表示に影響しない */}
        {showDualRoleMark && (
          <span
            className="absolute -bottom-1 -right-1 text-[11px] leading-none z-10"
            role="img"
            title={SOLO_NAPOLEON_LABELS.BADGE}
            aria-label={SOLO_NAPOLEON_LABELS.BADGE}
          >
            ⚔️
          </span>
        )}
      </div>
    </div>
  )
})
