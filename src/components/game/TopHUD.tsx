'use client'

import { memo, useMemo } from 'react'
import {
  DECLARATION_LABELS,
  GAME_CONFIG,
  NAPOLEON_RULES,
  PLAYER_ROLES,
  SOLO_NAPOLEON_LABELS,
  SUIT_SYMBOLS,
} from '@/lib/constants'
import { getGameProgress } from '@/lib/scoring'
import type { GameState } from '@/types/game'
import { isSoloNapoleon } from '@/utils/gameUtils'
import { ADJUTANT_BADGE_TONES, AdjutantCardBadge } from './AdjutantCardBadge'

interface TopHUDProps {
  gameState: GameState
  currentPlayerId?: string | null
}

export const TopHUD = memo(function TopHUD({
  gameState,
  currentPlayerId,
}: TopHUDProps) {
  const progress = useMemo(() => getGameProgress(gameState), [gameState])

  const targetFaceCards =
    gameState.napoleonDeclaration?.targetTricks ??
    NAPOLEON_RULES.TARGET_FACE_CARDS
  const totalFaceCards = NAPOLEON_RULES.TOTAL_FACE_CARDS

  const napPercent = (progress.napoleonTeamFaceCards / totalFaceCards) * 100
  const alliPercent = (progress.citizenTeamFaceCards / totalFaceCards) * 100
  // バー上での宣言ラインの位置。「どこまで伸びれば達成なのか」を可視化する
  const targetPercent = (targetFaceCards / totalFaceCards) * 100

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
          {progress.tricksPlayed} / {GAME_CONFIG.CARDS_PER_PLAYER}
        </span>
      </div>

      {/* 宣言した絵札数は盤面で最も参照される公開情報。
          進捗バーの補足に埋もれないよう、トリック数と対等な独立チップにする */}
      {gameState.napoleonDeclaration && (
        <div className="flex items-center gap-2 bg-yellow-500/20 border border-yellow-400/40 rounded-[10px] px-3 py-1.5">
          <span className="text-[10px] tracking-widest uppercase text-yellow-200 font-bold">
            {DECLARATION_LABELS.DECLARED}
          </span>
          <span className="text-xl leading-none font-extrabold text-yellow-300">
            {targetFaceCards}
          </span>
          <span className="text-[10px] font-semibold text-yellow-200/90">
            {DECLARATION_LABELS.FACE_CARDS}
          </span>
        </div>
      )}

      {/* Face card progress bar */}
      <div className="flex-1 min-w-[180px] flex flex-col gap-0.5 order-last lg:order-none w-full lg:w-auto">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] tracking-widest uppercase text-green-300 font-bold">
            {DECLARATION_LABELS.PROGRESS}
          </span>
          <span className="text-sm font-extrabold text-white whitespace-nowrap">
            <span className="text-yellow-300">
              {progress.napoleonTeamFaceCards}
            </span>
            {' / '}
            {targetFaceCards}
          </span>
        </div>
        <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="absolute inset-0 flex">
            <div
              className="h-full bg-yellow-500 transition-all duration-300"
              style={{ width: `${napPercent}%` }}
            />
            <div
              className="h-full bg-blue-400 transition-all duration-300"
              style={{ width: `${alliPercent}%` }}
            />
          </div>
          {/* 宣言ラインの目印 */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/80"
            style={{ left: `${targetPercent}%` }}
          />
        </div>
        {/* 獲得枚数と「あと何枚か」を両陣営分そろえる。
            連合軍は達成枚数ではなく阻止までの残り枚数を知りたいため */}
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 mt-1 text-xs">
          <span className="text-yellow-300">
            {progress.napoleonTeamFaceCards} {PLAYER_ROLES.NAPOLEON}
            {DECLARATION_LABELS.SEPARATOR}
            {progress.napoleonNeedsToWin > 0 ? (
              <>
                {DECLARATION_LABELS.NEEDS}{' '}
                <b className="text-sm font-extrabold">
                  {progress.napoleonNeedsToWin}
                </b>{' '}
                {DECLARATION_LABELS.MORE}
              </>
            ) : (
              <b className="font-extrabold">
                {DECLARATION_LABELS.NAPOLEON_MET}
              </b>
            )}
          </span>
          <span className="text-blue-300">
            {progress.citizenTeamFaceCards} {PLAYER_ROLES.ALLIED_FORCES}
            {DECLARATION_LABELS.SEPARATOR}
            {progress.allianceNeedsToWin > 0 ? (
              <>
                {DECLARATION_LABELS.NEED}{' '}
                <b className="text-sm font-extrabold">
                  {progress.allianceNeedsToWin}
                </b>{' '}
                {DECLARATION_LABELS.MORE}
              </>
            ) : (
              <b className="font-extrabold">
                {DECLARATION_LABELS.ALLIANCE_MET}
              </b>
            )}
          </span>
        </div>
      </div>

      {/* Trump suit chip + adjutant designation card chip
          どちらもナポレオン宣言の公開情報なので、同じチップとして対等に並べる */}
      {(trumpSuit || gameState.napoleonCard) && (
        <div className="flex flex-wrap items-stretch gap-2 lg:gap-3">
          {trumpSuit && (
            <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-[10px] px-3 py-1.5 font-bold text-white">
              <span className="text-[10px] tracking-widest uppercase text-green-300">
                Trump
              </span>
              <span className="text-[22px] leading-none">
                {SUIT_SYMBOLS[trumpSuit]}
              </span>
            </div>
          )}
          {gameState.napoleonCard && (
            <AdjutantCardBadge
              card={gameState.napoleonCard}
              tone={ADJUTANT_BADGE_TONES.DARK}
            />
          )}
          {/* 一人ナポレオン: 指定カードが埋め札にあり副官が不在であることを明示。
              マスク済みなので、閲覧者に公開してよい場合のみ true になる */}
          {isSoloNapoleon(gameState) && (
            <div className="flex items-center bg-orange-500/20 border border-orange-400/40 rounded-[10px] px-3 py-1.5">
              <span className="text-[11px] tracking-wide uppercase text-orange-200 font-bold">
                {SOLO_NAPOLEON_LABELS.BADGE}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
})
