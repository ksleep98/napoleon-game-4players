'use client'

import type { NapoleonDeclaration } from '@/types/game'

interface DeclarationDisplayProps {
  declaration: NapoleonDeclaration
  showTitle?: boolean
}

export function DeclarationDisplay({
  declaration,
  showTitle = true,
}: DeclarationDisplayProps) {
  const getSuitDisplay = (suit: string) => {
    const suitMap = {
      clubs: '♣ クラブ',
      diamonds: '♦ ダイヤ',
      hearts: '♥ ハート',
      spades: '♠ スペード',
    }
    return suitMap[suit as keyof typeof suitMap] || suit
  }

  const getSuitColor = (suit: string) => {
    const colorMap = {
      clubs: 'text-gray-800',
      diamonds: 'text-red-500',
      hearts: 'text-red-500',
      spades: 'text-gray-800',
    }
    return colorMap[suit as keyof typeof colorMap] || 'text-gray-800'
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
      {showTitle && (
        <h3 className="text-lg font-bold text-yellow-800 mb-2">
          Adopted Napoleon Declaration
        </h3>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-700">
              {declaration.targetTricks}
            </div>
            <div className="text-sm text-yellow-600">tricks</div>
          </div>
          <div className="text-center">
            <div
              className={`text-3xl font-bold ${getSuitColor(declaration.suit)}`}
            >
              {getSuitDisplay(declaration.suit)}
            </div>
            <div className="text-sm text-yellow-600">trump suit</div>
          </div>
        </div>

        {declaration.adjutantCard && (
          <div className="text-center pt-2 border-t border-yellow-200">
            <div className="text-sm text-yellow-600 mb-1">Adjutant Card:</div>
            <div className="font-semibold text-yellow-800">
              {declaration.adjutantCard.rank} of {declaration.adjutantCard.suit}
            </div>
          </div>
        )}

        <div className="text-xs text-yellow-600 text-center mt-2">
          Napoleon team needs to win at least {declaration.targetTricks} tricks
          out of 20 total
        </div>
      </div>
    </div>
  )
}
