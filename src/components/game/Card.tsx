'use client'

import type { Card as CardType } from '@/types/game'

interface CardProps {
  card: CardType
  isPlayable?: boolean
  isSelected?: boolean
  size?: 'small' | 'medium' | 'large'
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
    small: 'w-12 h-16 text-xs',
    medium: 'w-16 h-24 text-sm',
    large: 'w-20 h-32 text-base',
  }

  const suitColors = {
    hearts: 'text-red-600',
    diamonds: 'text-red-600',
    clubs: 'text-black',
    spades: 'text-black',
  }

  const handleClick = () => {
    if (isPlayable && onClick) {
      onClick(card.id)
    }
  }

  return (
    <div
      role="button"
      tabIndex={isPlayable ? 0 : -1}
      className={`
        bg-white border-2 rounded-lg shadow-md flex flex-col items-center justify-center
        transition-all duration-200 select-none
        ${sizeClasses[size]}
        ${isPlayable ? 'cursor-pointer hover:bg-gray-50 hover:shadow-lg hover:-translate-y-1' : 'cursor-default'}
        ${isSelected ? 'border-blue-500 bg-blue-50 -translate-y-2 shadow-lg' : 'border-gray-300'}
        ${suitColors[card.suit]}
        ${className}
      `}
      onClick={handleClick}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && isPlayable) {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      <div className="font-bold">{card.rank}</div>
      <div className="text-lg">
        {card.suit === 'hearts' && '♥'}
        {card.suit === 'diamonds' && '♦'}
        {card.suit === 'clubs' && '♣'}
        {card.suit === 'spades' && '♠'}
      </div>
    </div>
  )
}
