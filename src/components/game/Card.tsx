'use client'

import { SUIT_DISPLAY_COLORS, SUIT_SYMBOLS } from '@/lib/constants'
import type { Card as CardType } from '@/types/game'

interface CardProps {
  card: CardType
  isPlayable?: boolean
  isSelected?: boolean
  size?: 'tiny' | 'small' | 'medium' | 'large'
  onClick?: (cardId: string) => void
  className?: string
}

export function Card({
  card,
  isPlayable = false,
  isSelected = false,
  size = 'medium',
  onClick,
  className = '',
}: CardProps) {
  const sizeClasses = {
    tiny: 'w-8 h-12 text-xs',
    small: 'w-12 h-16 text-xs',
    medium: 'w-16 h-24 text-sm',
    large: 'w-20 h-32 text-base',
  }

  const handleClick = () => {
    if (isPlayable && onClick) {
      onClick(card.id)
    }
  }

  // 定数参照を使用してTailwindのPurge問題を回避
  const getSuitColor = (suit: string) => {
    return (
      SUIT_DISPLAY_COLORS[suit as keyof typeof SUIT_DISPLAY_COLORS] ||
      'text-black font-bold'
    )
  }

  return (
    <button
      type="button"
      disabled={!isPlayable}
      className={`
        bg-white border-2 rounded-lg shadow-md flex flex-col items-center justify-center
        transition-all duration-200 select-none
        ${className}
        ${sizeClasses[size]}
        ${
          isPlayable
            ? 'cursor-pointer hover:bg-gray-50 hover:shadow-lg hover:-translate-y-1'
            : 'cursor-default'
        }
        ${
          isSelected
            ? 'border-blue-500 bg-blue-50 -translate-y-2 shadow-lg'
            : 'border-gray-300'
        }
        ${getSuitColor(card.suit)}
      `}
      onClick={handleClick}
    >
      <div className="font-bold">{card.rank}</div>
      <div className="text-lg">{SUIT_SYMBOLS[card.suit]}</div>
    </button>
  )
}
