'use client'

import { memo } from 'react'
import { ADJUTANT_CARD_LABEL } from '@/lib/constants'
import type { Card as CardType } from '@/types/game'
import { Card } from './Card'

/**
 * 副官「指定カード」バッジ
 *
 * ナポレオンが宣言時に全員へ告げる公開情報（どのカードを指定したか）を表示する。
 * 「誰が副官か」は秘匿情報なので、このコンポーネントはプレイヤー情報を一切受け取らない。
 *
 * 判別しやすさのため以下を重ねる:
 * - 実物のカード表現（Card コンポーネント／白地・スート色）
 * - スート記号（♠♥♦♣）… 形状で区別できる
 * - ランク + スート名のテキスト … 色覚に依存せず読める
 */

// トーン別クラス（Tailwind の content スキャン対象に静的な文字列として置く）
export const ADJUTANT_BADGE_TONES = {
  /** 濃色の盤面 HUD 上に置く場合 */
  DARK: 'dark',
  /** 明色のパネル（宣言内容の黄色パネルなど）に置く場合 */
  LIGHT: 'light',
} as const

export type AdjutantBadgeTone =
  (typeof ADJUTANT_BADGE_TONES)[keyof typeof ADJUTANT_BADGE_TONES]

const TONE_STYLES = {
  [ADJUTANT_BADGE_TONES.DARK]: {
    container: 'bg-white/10 border-white/15',
    label: 'text-green-300',
    value: 'text-white',
  },
  [ADJUTANT_BADGE_TONES.LIGHT]: {
    container: 'bg-yellow-100 border-yellow-300',
    label: 'text-yellow-700',
    value: 'text-yellow-900',
  },
} as const

interface AdjutantCardBadgeProps {
  /** 副官指定カード（公開情報） */
  card: CardType
  tone?: AdjutantBadgeTone
  className?: string
}

export const AdjutantCardBadge = memo(function AdjutantCardBadge({
  card,
  tone = ADJUTANT_BADGE_TONES.DARK,
  className = '',
}: AdjutantCardBadgeProps) {
  const toneStyles = TONE_STYLES[tone]

  return (
    <div
      className={`flex items-center gap-2 border rounded-[10px] px-3 py-1.5 ${toneStyles.container} ${className}`}
    >
      <div className="flex flex-col gap-0.5 leading-tight">
        <span
          className={`text-[10px] tracking-widest uppercase font-bold whitespace-nowrap ${toneStyles.label}`}
        >
          {ADJUTANT_CARD_LABEL}
        </span>
        <span
          className={`text-xs font-extrabold capitalize whitespace-nowrap ${toneStyles.value}`}
        >
          {`${card.rank} ${card.suit}`}
        </span>
      </div>
      <Card card={card} size="tiny" />
    </div>
  )
})
