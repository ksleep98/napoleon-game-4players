'use client'

import { memo, useMemo } from 'react'
import { SUIT_SYMBOLS } from '@/lib/constants'
import { getGameProgress } from '@/lib/scoring'
import type { GameState } from '@/types/game'

interface TopHUDProps {
  gameState: GameState
  currentPlayerId?: string | null
}

export const TopHUD = memo(function TopHUD({
  gameState,
  currentPlayerId,
}: TopHUDProps) {
  const progress = useMemo(() => getGameProgress(gameState), [gameState])

  const targetFaceCards = gameState.napoleonDeclaration?.targetTricks ?? 13
  const totalFaceCards = 20

  const napPercent = (progress.napoleonTeamFaceCards / totalFaceCards) * 100
  const alliPercent = (progress.citizenTeamFaceCards / totalFaceCards) * 100

  const trumpSuit = gameState.trumpSuit ?? gameState.napoleonDeclaration?.suit

  return (
    <div className="flex flex-wrap items-center gap-3 lg:gap-4 bg-gray-900/70 backdrop-blur-lg border border-white/10 rounded-[14px] px-3 lg:px-4 py-2.5">
      {/* Logo */}
      <div className="flex items-center gap-2 pr-3 border-r border-white/10">
        <div className="w-[30px] h-[30px] rounded-lg bg-white text-gray-900 flex items-center justify-center text-lg font-black">
          ♠
        </div>
        <span className="font-extrabold text-white hidden sm:inline">
          Napoleon
        </span>
      </div>

      {/* Trick count */}
      <div className="flex flex-col gap-0.5 min-w-[60px]">
        <span className="text-[10px] tracking-widest uppercase text-green-300 font-bold">
          Trick
        </span>
        <span className="text-base font-extrabold text-white">
          {progress.tricksPlayed} / 12
        </span>
      </div>

      {/* Face card progress bar */}
      <div className="flex-1 min-w-[180px] flex flex-col gap-0.5 order-last lg:order-none w-full lg:w-auto">
        <span className="text-[10px] tracking-widest uppercase text-green-300 font-bold">
          Face cards toward declaration ({targetFaceCards})
        </span>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden flex">
          <div
            className="h-full bg-yellow-500 transition-all duration-300"
            style={{ width: `${napPercent}%` }}
          />
          <div
            className="h-full bg-blue-400 transition-all duration-300"
            style={{ width: `${alliPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-white/80 mt-0.5">
          <span className="text-yellow-400">
            <b>{progress.napoleonTeamFaceCards}</b> Napoleon
          </span>
          <span className="text-blue-400">
            <b>{progress.citizenTeamFaceCards}</b> Alliance
          </span>
          <span>
            Napoleon needs <b>{progress.napoleonNeedsToWin}</b> more
          </span>
        </div>
      </div>

      {/* Trump suit chip */}
      {trumpSuit && (
        <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-[10px] px-3 py-1.5 font-bold text-white">
          <span className="text-[10px] tracking-widest uppercase opacity-70">
            Trump
          </span>
          <span className="text-[22px] leading-none">
            {SUIT_SYMBOLS[trumpSuit]}
          </span>
        </div>
      )}
    </div>
  )
})
