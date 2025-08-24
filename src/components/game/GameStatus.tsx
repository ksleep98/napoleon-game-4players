'use client'

import { getGameProgress, getPlayerStats } from '@/lib/scoring'
import type { GameState } from '@/types/game'

interface GameStatusProps {
  gameState: GameState
  currentPlayerId?: string
}

export function GameStatus({ gameState, currentPlayerId }: GameStatusProps) {
  const progress = getGameProgress(gameState)
  const napoleonPlayer = gameState.players.find((p) => p.isNapoleon)
  const adjutantPlayer = gameState.players.find((p) => p.isAdjutant)

  const currentPlayerStats = currentPlayerId
    ? getPlayerStats(gameState, currentPlayerId)
    : null

  const getPhaseDisplay = (phase: string) => {
    const phaseMap = {
      setup: 'Game Setup',
      dealing: 'Dealing Cards',
      napoleon: 'Napoleon Declaration',
      adjutant: 'Adjutant Selection',
      playing: 'Playing',
      finished: 'Game Finished',
    }
    return phaseMap[phase as keyof typeof phaseMap] || phase
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
      {/* ゲーム基本情報 */}
      <div className="border-b pb-3">
        <h3 className="font-bold text-lg text-gray-800">Game Status</h3>
        <div className="text-sm text-gray-600 space-y-1 mt-2">
          <div>
            Phase:{' '}
            <span className="font-medium">
              {getPhaseDisplay(gameState.phase)}
            </span>
          </div>
          <div>
            Game ID: <span className="font-mono text-xs">{gameState.id}</span>
          </div>
        </div>
      </div>

      {/* チーム構成 */}
      {(napoleonPlayer || adjutantPlayer) && (
        <div className="border-b pb-3">
          <h4 className="font-semibold text-gray-800 mb-2">Teams</h4>
          <div className="space-y-2 text-sm">
            {napoleonPlayer && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full text-xs font-bold">
                  Napoleon
                </span>
                <span>{napoleonPlayer.name}</span>
              </div>
            )}
            {adjutantPlayer && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs font-bold">
                  Adjutant
                </span>
                <span>{adjutantPlayer.name}</span>
              </div>
            )}
            <div className="text-xs text-gray-500 mt-2">
              Citizens:{' '}
              {gameState.players
                .filter((p) => !p.isNapoleon && !p.isAdjutant)
                .map((p) => p.name)
                .join(', ')}
            </div>
          </div>
        </div>
      )}

      {/* ゲーム進行状況 */}
      {gameState.phase === 'playing' && (
        <div className="border-b pb-3">
          <h4 className="font-semibold text-gray-800 mb-2">Progress</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Tricks Played:</span>
              <span>{progress.tricksPlayed}/12</span>
            </div>
            <div className="flex justify-between">
              <span>Napoleon Team:</span>
              <span className="font-medium text-yellow-600">
                {progress.napoleonTeamTricks}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Citizen Team:</span>
              <span className="font-medium text-blue-600">
                {progress.citizenTeamTricks}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>Napoleon needs:</span>
              <span>{progress.napoleonNeedsToWin} more tricks</span>
            </div>

            {/* プログレスバー */}
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span>Napoleon Progress</span>
                <span>{progress.napoleonTeamTricks}/8</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(progress.napoleonTeamTricks / 8) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 現在のプレイヤー情報 */}
      {currentPlayerStats && (
        <div className="border-b pb-3">
          <h4 className="font-semibold text-gray-800 mb-2">Your Stats</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Role:</span>
              <span className="capitalize font-medium">
                {currentPlayerStats.role}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Tricks Won:</span>
              <span>{currentPlayerStats.tricksWon}</span>
            </div>
            <div className="flex justify-between">
              <span>Cards in Hand:</span>
              <span>{currentPlayerStats.cardsInHand}</span>
            </div>
            <div className="flex justify-between">
              <span>Cards Played:</span>
              <span>{currentPlayerStats.cardsPlayed}</span>
            </div>
          </div>
        </div>
      )}

      {/* 現在のトリック情報 */}
      {gameState.currentTrick.cards.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">Current Trick</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Cards Played:</span>
              <span>{gameState.currentTrick.cards.length}/4</span>
            </div>
            {gameState.leadingSuit && (
              <div className="flex justify-between">
                <span>Leading Suit:</span>
                <span className="capitalize">{gameState.leadingSuit}</span>
              </div>
            )}
            {gameState.trumpSuit && (
              <div className="flex justify-between">
                <span>Trump Suit:</span>
                <span className="capitalize">{gameState.trumpSuit}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ナポレオンカード表示 */}
      {gameState.napoleonCard && (
        <div className="bg-yellow-50 p-3 rounded-lg">
          <div className="text-sm">
            <span className="font-semibold">Napoleon's Card: </span>
            <span>
              {gameState.napoleonCard.rank} of {gameState.napoleonCard.suit}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
