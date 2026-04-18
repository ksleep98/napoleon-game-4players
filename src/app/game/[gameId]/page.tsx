'use client'

import dynamic from 'next/dynamic'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AIDifficultyBadge } from '@/components/game/AIDifficultyBadge'
import { Card } from '@/components/game/Card'
import { CompactGameProgress, GameStatus } from '@/components/game/GameStatus'
import { PlayerHand } from '@/components/game/PlayerHand'
import { TopHUD } from '@/components/game/TopHUD'
import { GameProvider, useGame } from '@/contexts/GameContext'
import { GAME_PHASES } from '@/lib/constants'
import { getNextDeclarationPlayer } from '@/lib/napoleonRules'
import { calculateGameResult, getPlayerFaceCardCount } from '@/lib/scoring'
import type { Card as CardType, NapoleonDeclaration } from '@/types/game'

// 動的インポート - 初期バンドルサイズを削減
const GameBoard = dynamic(
  () =>
    import('@/components/game/GameBoard').then((mod) => ({
      default: mod.GameBoard,
    })),
  {
    loading: () => (
      <div className="flex items-center justify-center h-64 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading game board...</p>
        </div>
      </div>
    ),
    ssr: false, // GameBoardはクライアント専用
  }
)

const TrickResult = dynamic(
  () =>
    import('@/components/game/TrickResult').then((mod) => ({
      default: mod.TrickResult,
    })),
  {
    loading: () => null, // TrickResultはオーバーレイなのでローディング表示不要
    ssr: false,
  }
)

const NapoleonSelector = dynamic(
  () =>
    import('@/components/game/NapoleonSelector').then((mod) => ({
      default: mod.NapoleonSelector,
    })),
  {
    loading: () => (
      <div className="flex items-center justify-center h-32 bg-white rounded-lg shadow-lg">
        <p className="text-sm text-gray-600">Loading Napoleon selection...</p>
      </div>
    ),
    ssr: false,
  }
)

const AdjutantSelector = dynamic(
  () =>
    import('@/components/game/AdjutantSelector').then((mod) => ({
      default: mod.AdjutantSelector,
    })),
  {
    loading: () => (
      <div className="flex items-center justify-center h-32 bg-white rounded-lg shadow-lg">
        <p className="text-sm text-gray-600">Loading Adjutant selection...</p>
      </div>
    ),
    ssr: false,
  }
)

const CardExchangeSelector = dynamic(
  () =>
    import('@/components/game/CardExchangeSelector').then((mod) => ({
      default: mod.CardExchangeSelector,
    })),
  {
    loading: () => (
      <div className="flex items-center justify-center h-32 bg-white rounded-lg shadow-lg">
        <p className="text-sm text-gray-600">Loading card exchange...</p>
      </div>
    ),
    ssr: false,
  }
)

function GamePageContent() {
  const searchParams = useSearchParams()
  const isMultiplayer = searchParams.get('multiplayer') === 'true'

  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  const { gameState, loading, error, actions, utils } = useGame()

  // actionsの参照を安定化
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  // マルチプレイヤーモードでplayerIdを取得
  useEffect(() => {
    if (isMultiplayer) {
      const storedPlayerId = localStorage.getItem('playerId')
      if (storedPlayerId && storedPlayerId !== currentPlayerId) {
        setCurrentPlayerId(storedPlayerId)
      }
    }
  }, [isMultiplayer, currentPlayerId])

  // プレイヤーIDを設定（AIモードでは人間プレイヤー、通常モードでは最初のプレイヤー）
  // プレイヤー構成の変化のみを監視（プレイヤー数とAIフラグの変化）
  const playerConfig = useMemo(() => {
    if (!gameState?.players || gameState.players.length === 0) return null

    const hasAI = gameState.players.some((p) => p.isAI)
    const humanPlayer = hasAI ? gameState.players.find((p) => !p.isAI) : null
    const firstPlayerId = gameState.players[0]?.id

    return {
      hasAI,
      humanPlayerId: humanPlayer?.id || null,
      firstPlayerId,
    }
  }, [gameState?.players])

  useEffect(() => {
    // マルチプレイヤーモードの場合はlocalStorageから取得するのでスキップ
    if (isMultiplayer) return

    if (!playerConfig) return

    if (playerConfig.hasAI && playerConfig.humanPlayerId) {
      if (playerConfig.humanPlayerId !== currentPlayerId) {
        setCurrentPlayerId(playerConfig.humanPlayerId)
      }
    } else if (!currentPlayerId && playerConfig.firstPlayerId) {
      setCurrentPlayerId(playerConfig.firstPlayerId)
    }
  }, [playerConfig, currentPlayerId, isMultiplayer])

  // 配り直しの自動検出と実行
  useEffect(() => {
    if (gameState?.needsRedeal) {
      // 1.5秒後に配り直しを実行（ユーザーにメッセージを表示するため）
      const timer = setTimeout(() => {
        actionsRef.current.redealCards()
      }, 1500)

      return () => clearTimeout(timer)
    }
  }, [gameState?.needsRedeal])

  // playableCardsの計算をメモ化 (early returnより前に配置)
  const playableCards = useMemo(() => {
    return currentPlayerId && gameState
      ? utils.getPlayableCards(currentPlayerId)
      : []
  }, [currentPlayerId, utils, gameState])

  if (loading || gameState?.needsRedeal) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">
            {gameState?.needsRedeal
              ? '全員がパスしました。カードを配り直しています...'
              : 'Loading game...'}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center bg-red-50 p-8 rounded-lg">
          <div className="text-red-600 text-xl font-semibold mb-2">Error</div>
          <p className="text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-gray-600">Game not found</p>
      </div>
    )
  }

  const currentPlayer = currentPlayerId
    ? gameState.players.find((p) => p.id === currentPlayerId)
    : null
  const isCurrentTurn = currentPlayerId
    ? utils.getCurrentPlayer()?.id === currentPlayerId
    : false

  const handleCardClick = (cardId: string) => {
    if (!isCurrentTurn || !playableCards.includes(cardId)) return

    setSelectedCardId(selectedCardId === cardId ? null : cardId)
  }

  const handlePlayCard = () => {
    if (!selectedCardId || !isCurrentTurn || !currentPlayerId) return

    actions.playCard(currentPlayerId, selectedCardId)
    setSelectedCardId(null)
  }

  const handleNapoleonSelect = (
    _playerId: string,
    declaration: NapoleonDeclaration
  ) => {
    actions.declareNapoleon(declaration)
  }

  const handleNapoleonPass = (playerId: string) => {
    actions.passNapoleon(playerId)
  }

  const handleAdjutantSelect = (adjutantCard: CardType) => {
    actions.setAdjutant(adjutantCard)
  }

  const handleCardExchange = (cardsToDiscard: CardType[]) => {
    if (!currentPlayerId) return
    actions.exchangeCards(currentPlayerId, cardsToDiscard)
  }

  // ゲーム終了時の結果表示
  if (gameState.phase === GAME_PHASES.FINISHED) {
    // トリック結果表示中は、ゲームボードも表示（早期終了の場合も含む）
    if (gameState.showingTrickResult && gameState.lastCompletedTrick) {
      // トリック結果表示を優先し、ゲーム結果画面は後で表示
      // ゲームボードも表示してトリック結果の背景として機能させる
      return (
        <div className="min-h-screen bg-gray-100 py-1 md:py-4">
          <div className="max-w-7xl mx-auto px-2 md:px-4">
            <div className="flex justify-between items-center mb-2 md:mb-6 py-1">
              <h1 className="text-lg md:text-2xl font-bold">Napoleon Game</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 md:gap-6">
              <div className="lg:col-span-3 space-y-2 md:space-y-6">
                {/* コンパクトなProgress表示 - モバイルのみ */}
                <div className="lg:hidden">
                  <CompactGameProgress gameState={gameState} />
                </div>

                {/* ゲームボード - 最後のトリックのカードを表示 */}
                <GameBoard
                  gameState={gameState}
                  currentPlayerId={currentPlayerId}
                />
              </div>

              {/* サイドバー - デスクトップのみ表示 */}
              <div className="hidden lg:block lg:col-span-1">
                <GameStatus
                  gameState={gameState}
                  currentPlayerId={currentPlayerId}
                />
              </div>
            </div>
          </div>

          {/* トリック結果表示（右下に表示） */}
          <TrickResult
            trick={gameState.lastCompletedTrick}
            players={gameState.players}
            onContinue={() => actions.closeTrickResult()}
          />
        </div>
      )
    }

    const result = calculateGameResult(gameState)

    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h1 className="text-3xl font-bold mb-6">Game Finished!</h1>

            <div className="mb-6">
              <div
                className={`text-2xl font-bold mb-2 ${
                  result.napoleonWon ? 'text-yellow-600' : 'text-blue-600'
                }`}
              >
                {result.napoleonWon
                  ? 'Napoleon Team Wins!'
                  : 'Allied Forces Win!'}
              </div>
              <p className="text-gray-600">
                Napoleon team won {result.faceCardsWon} out of 20 face cards
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {gameState.players.map((player) => {
                const faceCardsWon = getPlayerFaceCardCount(
                  gameState,
                  player.id
                )
                const isWinner = result.napoleonWon
                  ? player.isNapoleon || player.isAdjutant
                  : !player.isNapoleon && !player.isAdjutant

                return (
                  <div
                    key={player.id}
                    className={`p-4 rounded-lg ${
                      isWinner ? 'bg-green-100' : 'bg-red-100'
                    }`}
                  >
                    <div className="font-semibold">{player.name}</div>
                    <div className="text-sm text-gray-600">
                      {player.isNapoleon && 'Napoleon'}
                      {player.isAdjutant && 'Adjutant'}
                      {!player.isNapoleon &&
                        !player.isAdjutant &&
                        'Allied Forces'}
                    </div>
                    <div className="text-lg font-bold text-blue-600">
                      Face Cards Won: {faceCardsWon}
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                window.location.href = '/'
              }}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // PLAYING phase uses the redesigned felt layout
  if (gameState.phase === GAME_PHASES.PLAYING) {
    return (
      <div
        className="min-h-screen py-3 md:py-5 px-3 md:px-6"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, #1a6a3d 0%, #0f4a2a 70%, #0a3820 100%)',
        }}
      >
        <div className="max-w-[1180px] mx-auto space-y-4">
          {/* Top HUD bar */}
          <TopHUD gameState={gameState} currentPlayerId={currentPlayerId} />

          {/* Game table */}
          <GameBoard gameState={gameState} currentPlayerId={currentPlayerId} />

          {/* Player hand */}
          {currentPlayer && (
            <div className="space-y-3">
              <PlayerHand
                player={currentPlayer}
                isCurrentPlayer={isCurrentTurn}
                onCardClick={handleCardClick}
                selectedCardId={selectedCardId || undefined}
                playableCardIds={playableCards}
              />

              {/* Play button */}
              {isCurrentTurn && selectedCardId && (
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={handlePlayCard}
                    className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-[10px] transition-colors cursor-pointer"
                  >
                    Play Selected Card
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Face cards won grid */}
          <div className="bg-gray-900/70 backdrop-blur-lg border border-white/10 rounded-[14px] p-3 md:p-4">
            <h3 className="text-sm md:text-base font-bold text-white mb-2 md:mb-3">
              Face Cards Won
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
              {gameState.players.map((player) => {
                const wonTricks = gameState.tricks.filter(
                  (trick) => trick.winnerPlayerId === player.id
                )
                const faceCards = wonTricks.flatMap((trick) =>
                  trick.cards
                    .filter((pc) =>
                      ['10', 'J', 'Q', 'K', 'A'].includes(pc.card.rank)
                    )
                    .map((pc) => pc.card)
                )

                const isAdjutantRevealed =
                  gameState.tricks.some((trick) =>
                    trick.cards.some(
                      (playedCard) =>
                        gameState.napoleonCard &&
                        playedCard.card.id === gameState.napoleonCard.id
                    )
                  ) ||
                  gameState.tricks.some((trick) =>
                    trick.cards.some((playedCard) => playedCard.revealsAdjutant)
                  ) ||
                  gameState.currentTrick.cards.some(
                    (playedCard) => playedCard.revealsAdjutant
                  )

                return (
                  <div
                    key={player.id}
                    className="border border-white/10 rounded-lg p-2 md:p-3 bg-white/5"
                  >
                    <div className="flex items-center gap-1 md:gap-2 mb-1">
                      <h4 className="text-xs md:text-sm font-semibold text-white truncate">
                        {player.name}
                      </h4>
                      {player.isNapoleon && (
                        <span className="px-1 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full text-[0.6rem] font-bold">
                          N
                        </span>
                      )}
                      {player.isAdjutant &&
                        (player.id === currentPlayerId ||
                          isAdjutantRevealed) && (
                          <span className="px-1 py-0.5 bg-green-500/20 text-green-400 rounded-full text-[0.6rem] font-bold">
                            A
                          </span>
                        )}
                    </div>
                    <div className="text-[0.65rem] text-white/60 mb-1">
                      Cards: {faceCards.length}
                    </div>
                    {faceCards.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {faceCards.map((card, index) => (
                          <Card
                            key={`${card.id}-${index}`}
                            card={card}
                            size="tiny"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-white/30 text-xs">
                        No face cards yet
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Trick result overlay */}
        {gameState.showingTrickResult && gameState.lastCompletedTrick && (
          <TrickResult
            trick={gameState.lastCompletedTrick}
            players={gameState.players}
            onContinue={() => actions.closeTrickResult()}
          />
        )}
      </div>
    )
  }

  // Non-playing phases use the original layout
  return (
    <div className="min-h-screen bg-gray-100 py-1 md:py-4">
      <div className="max-w-7xl mx-auto px-2 md:px-4">
        <div className="flex justify-between items-center mb-2 md:mb-6 py-1">
          <h1 className="text-lg md:text-2xl font-bold">Napoleon Game</h1>
          <div className="flex items-center gap-2 md:gap-4">
            {gameState?.players.some((p) => p.isAI) && <AIDifficultyBadge />}
            {gameState?.players.some((p) => p.isAI) && (
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/'
                }}
                className="px-2 py-1 md:px-4 md:py-2 text-sm md:text-base bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
              >
                ← Home
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 md:gap-6">
          <div className="lg:col-span-3 space-y-2 md:space-y-6">
            {gameState.phase === GAME_PHASES.NAPOLEON && (
              <NapoleonSelector
                players={gameState.players}
                currentPlayerId={currentPlayerId}
                currentDeclaration={gameState.napoleonDeclaration}
                nextDeclarationPlayerId={
                  getNextDeclarationPlayer(gameState)?.id || null
                }
                onNapoleonSelect={handleNapoleonSelect}
                onPass={handleNapoleonPass}
              />
            )}

            {gameState.phase === GAME_PHASES.ADJUTANT &&
              currentPlayerId &&
              gameState.napoleonDeclaration &&
              gameState.napoleonDeclaration.playerId === currentPlayerId && (
                <AdjutantSelector
                  gameState={gameState}
                  napoleonPlayerId={gameState.napoleonDeclaration.playerId}
                  onAdjutantSelect={handleAdjutantSelect}
                />
              )}

            {gameState.phase === GAME_PHASES.EXCHANGE &&
              currentPlayerId &&
              gameState.napoleonDeclaration &&
              gameState.napoleonDeclaration.playerId === currentPlayerId && (
                <CardExchangeSelector
                  gameState={gameState}
                  napoleonPlayerId={gameState.napoleonDeclaration.playerId}
                  onCardExchange={handleCardExchange}
                />
              )}

            <div className="lg:hidden">
              <CompactGameProgress gameState={gameState} />
            </div>

            {currentPlayer && (
              <div className="space-y-2 md:space-y-4">
                <PlayerHand
                  player={currentPlayer}
                  isCurrentPlayer={isCurrentTurn}
                  onCardClick={handleCardClick}
                  selectedCardId={selectedCardId || undefined}
                  playableCardIds={playableCards}
                />

                {isCurrentTurn && selectedCardId && (
                  <div className="text-center py-1">
                    <button
                      type="button"
                      onClick={handlePlayCard}
                      className="px-4 py-2 md:px-6 md:py-3 text-sm md:text-base bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Play Selected Card
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="hidden lg:block lg:col-span-1">
            <GameStatus
              gameState={gameState}
              currentPlayerId={currentPlayerId}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GamePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const gameId = params.gameId as string

  // URLクエリパラメータを取得
  const playersParam = searchParams.get('players')
  const isAI = searchParams.get('ai') === 'true'
  const playerNames = playersParam ? playersParam.split(',') : undefined

  return (
    <GameProvider gameId={gameId} playerNames={playerNames} isAI={isAI}>
      <GamePageContent />
    </GameProvider>
  )
}
