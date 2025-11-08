'use client'

import {
  GAME_PHASES,
  NAPOLEON_RULES,
  PLAYER_ROLES,
  SUIT_SYMBOLS,
} from '@/lib/constants'
import {
  getGameProgress,
  getPlayerFaceCardCount,
  getPlayerStats,
} from '@/lib/scoring'
import type { GameState } from '@/types/game'

interface GameStatusProps {
  gameState: GameState
  currentPlayerId?: string | null
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
      [GAME_PHASES.SETUP]: 'Game Setup',
      dealing: 'Dealing Cards',
      [GAME_PHASES.NAPOLEON]: 'Napoleon Declaration',
      [GAME_PHASES.ADJUTANT]: 'Adjutant Selection',
      [GAME_PHASES.EXCHANGE]: 'Card Exchange',
      [GAME_PHASES.PLAYING]: 'Playing',
      [GAME_PHASES.FINISHED]: 'Game Finished',
    }
    return phaseMap[phase as keyof typeof phaseMap] || phase
  }

  const getRoleDisplay = (role: string) => {
    const roleMap = {
      napoleon: PLAYER_ROLES.NAPOLEON,
      adjutant: PLAYER_ROLES.ADJUTANT,
      citizen: 'Allied Forces',
    }
    return roleMap[role as keyof typeof roleMap] || role
  }

  // 副官が判明しているかどうかをチェック
  // 1. 副官プレイヤーが副官指定カードを出した場合（従来）
  // 2. ナポレオンが隠しカードから副官指定カードを出した場合（新機能）
  const isAdjutantRevealed =
    gameState.phase === GAME_PHASES.PLAYING &&
    // ケース1: 副官プレイヤーが副官指定カードを出した
    ((adjutantPlayer &&
      gameState.tricks.some((trick) =>
        trick.cards.some(
          (playedCard) =>
            gameState.napoleonCard &&
            playedCard.card.id === gameState.napoleonCard.id
        )
      )) ||
      // ケース2: ナポレオンが隠しカードから副官指定カードを出した
      gameState.tricks.some((trick) =>
        trick.cards.some((playedCard) => playedCard.revealsAdjutant)
      ) ||
      // ケース3: 現在のトリックでナポレオンが隠しカードから副官カードを出した
      gameState.currentTrick.cards.some(
        (playedCard) => playedCard.revealsAdjutant
      ))

  return (
    <div className="bg-white rounded-lg shadow-md p-2 md:p-4 space-y-2 md:space-y-4">
      {/* ゲーム基本情報 - Phase と Game ID を非表示 */}
      <div className="border-b pb-2 md:pb-3">
        <h3 className="font-bold text-base md:text-lg text-gray-800">
          Game Status
        </h3>
      </div>

      {/* ナポレオン宣言情報 - モバイル最適化 */}
      {gameState.napoleonDeclaration && (
        <div className="border-b pb-2 md:pb-3">
          <h4 className="font-semibold text-sm md:text-base text-gray-800 mb-1 md:mb-2">
            Napoleon Declaration
          </h4>
          <div className="bg-yellow-50 border border-yellow-200 p-2 md:p-3 rounded-lg">
            <div className="flex items-center justify-center gap-2 md:gap-4 text-sm">
              <div className="text-center">
                <div className="text-base md:text-xl font-bold text-yellow-700">
                  {gameState.napoleonDeclaration.targetTricks}
                </div>
                <div className="text-[0.6rem] md:text-xs text-yellow-600">
                  tricks
                </div>
              </div>
              <div className="text-center">
                <div className="text-xl md:text-2xl font-bold text-yellow-700">
                  {SUIT_SYMBOLS[gameState.napoleonDeclaration.suit]}
                </div>
                <div className="text-[0.6rem] md:text-xs text-yellow-600 capitalize">
                  {gameState.napoleonDeclaration.suit}
                </div>
              </div>
            </div>
            <div className="text-center text-xs md:text-sm text-yellow-700 mt-1 md:mt-2">
              <span className="font-semibold">
                Declared by: {napoleonPlayer?.name}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* チーム構成 - 副官は判明した場合のみ表示 */}
      {napoleonPlayer && (
        <div className="border-b pb-3">
          <h4 className="font-semibold text-gray-800 mb-2">Teams</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full text-xs font-bold">
                {PLAYER_ROLES.NAPOLEON}
              </span>
              <span>{napoleonPlayer.name}</span>
            </div>
            {isAdjutantRevealed && adjutantPlayer && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs font-bold">
                  {PLAYER_ROLES.ADJUTANT}
                </span>
                <span>{adjutantPlayer.name}</span>
              </div>
            )}
            {!isAdjutantRevealed && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded-full text-xs font-bold">
                  {PLAYER_ROLES.ADJUTANT}
                </span>
                <span className="text-gray-600">??? (Hidden)</span>
              </div>
            )}
            <div className="text-xs text-gray-500 mt-2">
              Allied Forces:{' '}
              {gameState.players
                .filter(
                  (p) => !p.isNapoleon && (!isAdjutantRevealed || !p.isAdjutant)
                )
                .map((p) => p.name)
                .join(', ')}
              {!isAdjutantRevealed && ' (includes hidden adjutant)'}
            </div>
          </div>
        </div>
      )}

      {/* 切り札スート表示 - ゲーム中のみ */}
      {gameState.phase === GAME_PHASES.PLAYING && gameState.trumpSuit && (
        <div className="border-b pb-3">
          <h4 className="font-semibold text-gray-800 mb-2">Trump Suit</h4>
          <div className="flex items-center justify-center bg-red-50 border border-red-200 p-3 rounded-lg">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">
                {SUIT_SYMBOLS[gameState.trumpSuit]}
              </div>
              <div className="text-sm text-red-600 capitalize font-medium">
                {gameState.trumpSuit}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ゲーム進行状況 */}
      {gameState.phase === GAME_PHASES.PLAYING && (
        <div className="border-b pb-3">
          <h4 className="font-semibold text-gray-800 mb-2">Progress</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Tricks Played:</span>
              <span>{progress.tricksPlayed}/12</span>
            </div>
            <div className="flex justify-between">
              <span>{PLAYER_ROLES.NAPOLEON} Team Face Cards:</span>
              <span className="font-medium text-yellow-600">
                {progress.napoleonTeamFaceCards}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Allied Forces Face Cards:</span>
              <span className="font-medium text-blue-600">
                {progress.citizenTeamFaceCards}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>{PLAYER_ROLES.NAPOLEON} needs:</span>
              <span>{progress.napoleonNeedsToWin} more face cards</span>
            </div>

            {/* プログレスバー */}
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span>{PLAYER_ROLES.NAPOLEON} Face Card Progress</span>
                <span>
                  {progress.napoleonTeamFaceCards}/
                  {gameState.napoleonDeclaration?.targetTricks ??
                    NAPOLEON_RULES.TARGET_FACE_CARDS}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(progress.napoleonTeamFaceCards / (gameState.napoleonDeclaration?.targetTricks ?? NAPOLEON_RULES.TARGET_FACE_CARDS)) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* プレイヤー別絵札獲得数 */}
      {gameState.phase === GAME_PHASES.PLAYING && (
        <div className="border-b pb-3">
          <h4 className="font-semibold text-gray-800 mb-2">
            Face Cards Won by Player
          </h4>
          <div className="space-y-1 text-sm">
            {gameState.players.map((player) => {
              const faceCardsWon = getPlayerFaceCardCount(gameState, player.id)
              const roleColor = player.isNapoleon
                ? 'text-yellow-600'
                : player.isAdjutant && isAdjutantRevealed
                  ? 'text-green-600'
                  : 'text-blue-600'

              return (
                <div
                  key={player.id}
                  className="flex justify-between items-center"
                >
                  <div className="flex items-center gap-2">
                    <span>{player.name}</span>
                    {player.isNapoleon && (
                      <span className="px-1 py-0 bg-yellow-200 text-yellow-800 rounded text-xs">
                        N
                      </span>
                    )}
                    {player.isAdjutant && isAdjutantRevealed && (
                      <span className="px-1 py-0 bg-green-200 text-green-800 rounded text-xs">
                        A
                      </span>
                    )}
                  </div>
                  <span className={`font-medium ${roleColor}`}>
                    {faceCardsWon} face cards
                  </span>
                </div>
              )
            })}
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
              <span className="font-medium">
                {getRoleDisplay(currentPlayerStats.role)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Face Cards Won:</span>
              <span>{currentPlayerStats.faceCardsWon}</span>
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
          </div>
        </div>
      )}

      {/* 副官指定カードは隠す - 判明後のみヒント表示 */}
      {gameState.napoleonCard && isAdjutantRevealed && (
        <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
          <div className="text-sm text-green-700">
            <span className="font-semibold">
              {PLAYER_ROLES.ADJUTANT} was found by:{' '}
            </span>
            <span>
              {gameState.napoleonCard.rank} of {gameState.napoleonCard.suit}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
