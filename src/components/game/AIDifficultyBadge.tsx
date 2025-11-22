'use client'

import { useState } from 'react'

type AIDifficulty = 'easy' | 'normal' | 'hard'

interface DifficultyInfo {
  label: string
  color: string
  bgColor: string
  description: string
  napoleonStrategy: string
  playingStrategy: string
}

const DIFFICULTY_INFO: Record<AIDifficulty, DifficultyInfo> = {
  easy: {
    label: 'Easy',
    color: 'text-green-700',
    bgColor: 'bg-green-100 border-green-300',
    description: 'Fast heuristic AI',
    napoleonStrategy: 'Heuristic (hand strength evaluation)',
    playingStrategy: 'Heuristic (basic card selection)',
  },
  normal: {
    label: 'Normal',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100 border-blue-300',
    description: 'Balanced hybrid AI',
    napoleonStrategy: 'MCTS Fast (10 simulations/option)',
    playingStrategy: 'Hybrid (heuristic + MCTS Fast)',
  },
  hard: {
    label: 'Hard',
    color: 'text-red-700',
    bgColor: 'bg-red-100 border-red-300',
    description: 'Strong MCTS-based AI',
    napoleonStrategy: 'MCTS Normal (20 simulations/option)',
    playingStrategy: 'Hybrid (heuristic + MCTS Normal)',
  },
}

export function AIDifficultyBadge() {
  const [showDetails, setShowDetails] = useState(false)

  // 環境変数から難易度を取得（クライアント側）
  const difficulty: AIDifficulty =
    (process.env.NEXT_PUBLIC_AI_DIFFICULTY as AIDifficulty) || 'normal'

  const info = DIFFICULTY_INFO[difficulty]

  return (
    <div className="relative">
      {/* バッジ */}
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className={`px-3 py-1.5 rounded-lg border-2 ${info.bgColor} ${info.color} font-semibold text-sm hover:opacity-80 transition-opacity flex items-center gap-2`}
      >
        <span className="text-xs">🤖 AI:</span>
        <span>{info.label}</span>
        <span className="text-xs">{showDetails ? '▼' : '▶'}</span>
      </button>

      {/* 詳細モーダル */}
      {showDetails && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-xl border-2 border-gray-300 p-4 z-50">
          <div className="space-y-3">
            <div className="border-b pb-2">
              <h4 className="font-bold text-lg flex items-center gap-2">
                <span>🤖</span>
                <span>AI Difficulty: {info.label}</span>
              </h4>
              <p className="text-sm text-gray-600 mt-1">{info.description}</p>
            </div>

            <div>
              <h5 className="font-semibold text-sm text-gray-700 mb-1">
                📋 Napoleon Declaration:
              </h5>
              <p className="text-xs text-gray-600 pl-4">
                {info.napoleonStrategy}
              </p>
            </div>

            <div>
              <h5 className="font-semibold text-sm text-gray-700 mb-1">
                🎴 Card Playing:
              </h5>
              <p className="text-xs text-gray-600 pl-4">
                {info.playingStrategy}
              </p>
            </div>

            <div className="border-t pt-2">
              <p className="text-xs text-gray-500">
                💡 Set in{' '}
                <code className="bg-gray-100 px-1 rounded">.env.local</code>:
              </p>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded block mt-1">
                NEXT_PUBLIC_AI_DIFFICULTY={difficulty}
              </code>
            </div>

            <button
              type="button"
              onClick={() => setShowDetails(false)}
              className="w-full py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
