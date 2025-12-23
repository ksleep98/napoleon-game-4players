import { GAME_PHASES } from '@/lib/constants'
import type { Card, GameState } from '@/types/game'
import {
  declareNapoleon,
  exchangeCards,
  getCurrentPlayer,
  passNapoleonDeclaration,
  playCard,
  setAdjutant,
} from '../gameLogic'
import {
  advanceNapoleonPhase,
  canDeclareNapoleon,
  getNextDeclarationPlayer,
} from '../napoleonRules'
import {
  type AIDifficultyLevel,
  getStrategyConfigByDifficulty,
  selectAICard as selectAICardWithStrategy,
} from './aiStrategy'
import { allianceAIStrategy } from './alliance'
import { getPlayableCards as getPlayableCardsFromSimulator } from './gameSimulator'
import { napoleonAIStrategy } from './napoleon'
import {
  NAPOLEON_MCTS_PRESETS,
  napoleonAIStrategyWithMCTS,
} from './napoleonMCTS'

// ナポレオン決定フェーズの AI 処理（改善版）
export async function processNapoleonPhase(
  gameState: GameState
): Promise<GameState> {
  let updatedGameState = { ...gameState }

  // 現在の宣言者がAIかチェック
  const currentPlayer = getNextDeclarationPlayer(updatedGameState)
  if (!currentPlayer || !currentPlayer.isAI) {
    // 次のプレイヤーがいない場合は副官フェーズへ
    if (!currentPlayer && updatedGameState.napoleonDeclaration) {
      return {
        ...updatedGameState,
        phase: GAME_PHASES.ADJUTANT,
        currentPlayerIndex: updatedGameState.players.findIndex(
          (p) => p.id === updatedGameState.napoleonDeclaration?.playerId
        ),
      }
    }
    return updatedGameState
  }

  // そのプレイヤーが実際に宣言可能かチェック
  if (!canDeclareNapoleon(updatedGameState, currentPlayer.id)) {
    // 次のプレイヤーに進む
    updatedGameState = advanceNapoleonPhase(updatedGameState)
    return updatedGameState
  }

  // AI難易度設定に基づいて戦略を選択
  const difficultyLevel: AIDifficultyLevel =
    (process.env.NEXT_PUBLIC_AI_DIFFICULTY as AIDifficultyLevel) || 'normal'

  let strategy: {
    shouldDeclare: boolean
    declaration?: import('@/types/game').NapoleonDeclaration
    adjutantCard?: Card
  }

  // Easy: ヒューリスティック、Normal/Hard: MCTS
  if (difficultyLevel === 'easy') {
    strategy = napoleonAIStrategy(updatedGameState, currentPlayer.id)
  } else {
    const mctsConfig =
      difficultyLevel === 'hard'
        ? NAPOLEON_MCTS_PRESETS.normal
        : NAPOLEON_MCTS_PRESETS.fast
    try {
      strategy = napoleonAIStrategyWithMCTS(
        updatedGameState,
        currentPlayer.id,
        mctsConfig
      )
    } catch (error) {
      console.error('Napoleon MCTS failed, falling back to heuristic:', error)
      strategy = napoleonAIStrategy(updatedGameState, currentPlayer.id)
    }
  }

  if (strategy.shouldDeclare && strategy.declaration) {
    // ナポレオンを宣言
    updatedGameState = declareNapoleon(updatedGameState, strategy.declaration)
  } else {
    // パス
    updatedGameState = passNapoleonDeclaration(
      updatedGameState,
      currentPlayer.id
    )
  }

  return updatedGameState
}

// 副官決定フェーズの AI 処理（改善版）
export async function processAdjutantPhase(
  gameState: GameState
): Promise<GameState> {
  let updatedGameState = { ...gameState }

  // ナポレオンプレイヤーを取得
  const napoleonPlayer = updatedGameState.players.find((p) => p.isNapoleon)

  // ナポレオンが人間プレイヤーの場合は自動処理をスキップ
  if (napoleonPlayer && !napoleonPlayer.isAI) {
    return updatedGameState
  }

  if (!updatedGameState.napoleonDeclaration?.adjutantCard) {
    // 副官カードが指定されていない場合はスキップ
    updatedGameState.phase = GAME_PHASES.EXCHANGE
    return updatedGameState
  }

  const adjutantCard = updatedGameState.napoleonDeclaration.adjutantCard
  updatedGameState = setAdjutant(updatedGameState, adjutantCard)

  return updatedGameState
}

// カード交換フェーズの AI 処理
export async function processCardExchangePhase(
  gameState: GameState
): Promise<GameState> {
  let updatedGameState = { ...gameState }

  if (!updatedGameState.napoleonDeclaration) {
    return updatedGameState
  }

  const napoleonPlayer = updatedGameState.players.find((p) => p.isNapoleon)
  if (!napoleonPlayer || !napoleonPlayer.isAI) {
    return updatedGameState
  }

  // AIが交換するカードを選択（ナポレオンの手札は既に16枚）
  const cardsToDiscard = selectCardsToDiscard(
    napoleonPlayer.hand,
    [] // 隠しカードは既に手札に統合済み
  )

  updatedGameState = exchangeCards(
    updatedGameState,
    napoleonPlayer.id,
    cardsToDiscard
  )

  return updatedGameState
}

// 捨てるカードを選択するAIロジック
function selectCardsToDiscard(hand: Card[], _hiddenCards: Card[]): Card[] {
  // ナポレオンの手札は既に16枚（元の手札+隠しカード）統合済み
  const allCards = hand

  // 価値の低い順にソート
  const sortedCards = allCards.sort((a, b) => {
    // 基本的な価値で比較
    if (a.value !== b.value) {
      return a.value - b.value
    }
    // 同じ価値なら、より多く持っているスートを優先して捨てる
    return 0
  })

  return sortedCards.slice(0, 4)
}

// 連合軍決定フェーズの AI 処理
export async function processAlliancePhase(
  gameState: GameState
): Promise<GameState> {
  const updatedGameState = { ...gameState }

  // 各 AI プレイヤー（ナポレオンチーム以外）の戦略を決定
  for (let i = 0; i < updatedGameState.players.length; i++) {
    const player = updatedGameState.players[i]

    if (player.isAI && !player.isNapoleon && !player.isAdjutant) {
      allianceAIStrategy(updatedGameState, player.id)
    }
  }

  // 連合軍戦略が決まったらゲーム開始
  updatedGameState.phase = GAME_PHASES.PLAYING

  return updatedGameState
}

// プレイングフェーズの AI 処理
export async function processAIPlayingPhase(
  gameState: GameState
): Promise<GameState> {
  let updatedState = { ...gameState }

  // 現在のプレイヤーがAIかチェック
  const currentPlayer = getCurrentPlayer(updatedState)

  if (!currentPlayer?.isAI) {
    return updatedState
  }

  // AIが出すカードを選択（非同期対応）
  const cardToPlay = await selectAICard(currentPlayer.hand, updatedState)

  if (cardToPlay) {
    updatedState = playCard(updatedState, currentPlayer.id, cardToPlay.id)
  }

  return updatedState
}

// AIのカード選択ロジック（ハイブリッド戦略版）
async function selectAICard(
  hand: Card[],
  gameState: GameState
): Promise<Card | null> {
  if (hand.length === 0) return null

  const currentPlayer = gameState.players.find(
    (p) => p.isAI && p.hand.some((card) => hand.includes(card))
  )

  if (!currentPlayer) {
    // フォールバック：従来のランダム選択
    return selectFallbackCard(hand, gameState)
  }

  // プレイ可能カードを取得
  const playableCards = getPlayableCards(hand, gameState)

  if (playableCards.length === 0) {
    return hand[0]
  }

  // AI難易度を取得（環境変数またはデフォルト）
  const difficultyLevel: AIDifficultyLevel =
    (process.env.NEXT_PUBLIC_AI_DIFFICULTY as AIDifficultyLevel) || 'normal'

  // ハイブリッド戦略を使用
  try {
    const strategyConfig = getStrategyConfigByDifficulty(difficultyLevel)
    const selectedCard = selectAICardWithStrategy(
      gameState,
      currentPlayer,
      strategyConfig
    )

    if (selectedCard) {
      return selectedCard
    }
  } catch (error) {
    // Fallback to simple selection
  }

  // フォールバック：従来のロジック
  return selectFallbackCard(playableCards, gameState)
}

/**
 * フォールバック用のシンプルな選択ロジック（従来版の改良）
 */
function selectFallbackCard(hand: Card[], gameState: GameState): Card {
  const currentTrick = gameState.currentTrick

  // 最初のカードの場合、適当に選ぶ
  if (currentTrick.cards.length === 0) {
    return hand[Math.floor(Math.random() * hand.length)]
  }

  // フォロー義務がある場合
  const leadingSuit = currentTrick.cards[0].card.suit
  const followingCards = hand.filter((card) => card.suit === leadingSuit)

  if (followingCards.length > 0) {
    // フォローできる場合は適当に選ぶ
    return followingCards[Math.floor(Math.random() * followingCards.length)]
  } else {
    // フォローできない場合は適当に選ぶ
    return hand[Math.floor(Math.random() * hand.length)]
  }
}

/**
 * プレイ可能なカードを取得（後方互換性のためのラッパー）
 */
function getPlayableCards(hand: Card[], gameState: GameState): Card[] {
  // 現在の手札を持つプレイヤーを見つける
  const player = gameState.players.find((p) =>
    p.hand.some((card) => hand.includes(card))
  )

  if (!player) {
    // プレイヤーが見つからない場合は従来のロジックを使用
    const currentTrick = gameState.currentTrick

    if (currentTrick.cards.length === 0) {
      return [...hand]
    }

    const leadingSuit = currentTrick.cards[0].card.suit
    const suitCards = hand.filter((card) => card.suit === leadingSuit)

    return suitCards.length > 0 ? suitCards : [...hand]
  }

  // gameSimulatorの関数を使用
  return getPlayableCardsFromSimulator(gameState, player.id)
}

// すべての AI フェーズを統合処理
export async function processAllAIPhases(
  gameState: GameState
): Promise<GameState> {
  let updatedState = gameState

  // ナポレオンフェーズでは一度に一人だけ処理
  if (gameState.phase === GAME_PHASES.NAPOLEON) {
    updatedState = await processNapoleonPhase(updatedState)
    // フェーズが変わったら処理停止（次回のAI処理で継続）
    return updatedState
  }

  if (updatedState.phase === GAME_PHASES.ADJUTANT) {
    updatedState = await processAdjutantPhase(updatedState)
    // 副官フェーズ後はカード交換に進む
    return updatedState
  }

  if (updatedState.phase === GAME_PHASES.EXCHANGE) {
    updatedState = await processCardExchangePhase(updatedState)
    return updatedState
  }

  if (updatedState.phase === GAME_PHASES.PLAYING) {
    updatedState = await processAlliancePhase(updatedState)
    return updatedState
  }

  return updatedState
}
