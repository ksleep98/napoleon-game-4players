/**
 * AI戦略切り替えシステム
 * ヒューリスティック、MCTS、ハイブリッドの選択
 */

import { GAME_PHASES, NODE_ENVIRONMENTS } from '@/lib/constants'
import { predictBestCard, type Role } from '@/lib/ml/mlClient'
import type { Card, GameState, Player } from '@/types/game'
import { getPlayableCards } from './gameSimulator'
import {
  MCTS_PRESETS,
  type MCTSConfig,
  selectCardWithDeterminization,
} from './monteCarloAI'
import { selectBestStrategicCard } from './strategicCardEvaluator'

/**
 * ML 推論の採用基準。閾値未満は MCTS / heuristic にフォールバックする。
 *
 * ロードマップ (docs/ml/ML_IMPLEMENTATION_ROADMAP.md Phase 4.2) の初期値は 0.6。
 * しかし 526 ゲーム/accuracy 26%・top-3 52% の時点でも、実プレイの top-1
 * confidence は概ね 0.10〜0.25 に分布し、ゲームによって max が 0.24〜0.58
 * と大きく振れる。これは Random Forest を 52 クラス分類で使う構造上の制約
 * (200本の木の票が複数候補に分散) であり、データ追加では緩やかにしか
 * 改善しない。
 *
 * 一方 top-3 accuracy は 52% に達しており、信頼度が低めでも「正解に近い
 * 手」が選ばれている可能性は高い。実プレイで ML を実際に発火させて挙動
 * を観察するため、当面 0.2 まで下げる(全 ML 判断のうち 20-40% が採用
 * される想定)。データ拡充・キャリブレーション・別モデル等で confidence
 * 分布が改善したら段階的に 0.3 → 0.5 → 0.6 に戻す。
 */
const ML_CONFIDENCE_THRESHOLD = 0.2

type MLLogEvent = 'adopt' | 'adopt-topk' | 'fallback' | 'skip'

function logML(event: MLLogEvent, detail: string): void {
  // Tests are noisy enough without this; production/dev keep visibility.
  if (process.env.NODE_ENV === 'test') return
  console.log(`[aiStrategy.ml] ${event}: ${detail}`)
}

/**
 * AI戦略タイプ
 */
export type AIStrategyType = 'heuristic' | 'mcts' | 'hybrid'

/**
 * AI難易度レベル
 */
export type AIDifficultyLevel = 'easy' | 'normal' | 'hard'

/**
 * AI戦略設定
 */
export interface AIStrategyConfig {
  strategy: AIStrategyType
  difficulty: AIDifficultyLevel
  mctsConfig?: MCTSConfig
}

/**
 * デフォルト戦略設定
 */
export const DEFAULT_STRATEGY_CONFIGS: Record<
  AIDifficultyLevel,
  AIStrategyConfig
> = {
  easy: {
    strategy: 'heuristic',
    difficulty: 'easy',
  },
  normal: {
    strategy: 'hybrid',
    difficulty: 'normal',
    mctsConfig: MCTS_PRESETS.fast,
  },
  hard: {
    strategy: 'mcts',
    difficulty: 'hard',
    mctsConfig: MCTS_PRESETS.fast,
  },
}

/**
 * `trumpSuit` 未設定のまま AI 評価に入った局面を開発時だけ警告する。
 *
 * AI 評価層は `(gameState.trumpSuit as Suit) || 'spades'` という防御的な
 * フォールバックを持つため、未設定でも例外にはならず「常にスペードが切り札」
 * として静かに誤動作する。フォールバック自体は残すが、宣言済みなのに
 * `trumpSuit` が欠けている状態は必ずバグなので、開発時に気付けるようにする。
 * （ゲームごとに 1 回だけ出力する）
 */
const warnedTrumpSuitGameIds = new Set<string>()

function warnIfTrumpSuitMissing(gameState: GameState): void {
  if (process.env.NODE_ENV !== NODE_ENVIRONMENTS.DEVELOPMENT) return
  if (gameState.phase !== GAME_PHASES.PLAYING) return
  if (gameState.trumpSuit) return
  if (!gameState.napoleonDeclaration) return
  if (warnedTrumpSuitGameIds.has(gameState.id)) return

  warnedTrumpSuitGameIds.add(gameState.id)
  console.warn(
    `[aiStrategy] gameState.trumpSuit is missing (game=${gameState.id}). ` +
      `AI evaluation will fall back to spades instead of the declared suit ` +
      `"${gameState.napoleonDeclaration.suit}".`
  )
}

/**
 * AI戦略でカードを選択
 * @param gameState 現在のゲーム状態
 * @param player プレイヤー
 * @param config AI戦略設定
 * @returns 選択されたカード
 */
export function selectAICard(
  gameState: GameState,
  player: Player,
  config: AIStrategyConfig
): Card | null {
  warnIfTrumpSuitMissing(gameState)

  const playableCards = getPlayableCards(gameState, player.id)

  if (playableCards.length === 0) {
    return null
  }

  if (playableCards.length === 1) {
    return playableCards[0]
  }

  switch (config.strategy) {
    case 'heuristic':
      return selectWithHeuristic(playableCards, gameState, player)

    case 'mcts':
      return selectWithMCTS(playableCards, gameState, player, config)

    case 'hybrid':
      return selectWithHybrid(playableCards, gameState, player, config)

    default:
      return selectWithHeuristic(playableCards, gameState, player)
  }
}

/**
 * ヒューリスティック評価でカードを選択
 */
function selectWithHeuristic(
  playableCards: Card[],
  gameState: GameState,
  player: Player
): Card | null {
  return selectBestStrategicCard(playableCards, gameState, player)
}

/**
 * MCTSでカードを選択
 */
function selectWithMCTS(
  playableCards: Card[],
  gameState: GameState,
  player: Player,
  config: AIStrategyConfig
): Card {
  const mctsConfig = config.mctsConfig || MCTS_PRESETS.normal

  return selectCardWithDeterminization(
    gameState,
    player,
    playableCards,
    mctsConfig
  )
}

/**
 * ハイブリッド戦略でカードを選択
 * ゲーム進行状況に応じてヒューリスティックとMCTSを切り替え
 */
function selectWithHybrid(
  playableCards: Card[],
  gameState: GameState,
  player: Player,
  config: AIStrategyConfig
): Card | null {
  const gameProgress = calculateGameProgress(gameState)
  const handSize = player.hand.length

  // 序盤（0-30%）: ヒューリスティック（高速）
  if (gameProgress < 0.3) {
    return selectWithHeuristic(playableCards, gameState, player)
  }

  // 中盤（30-70%）: 手札が多い場合はヒューリスティック、少ない場合はMCTS
  if (gameProgress < 0.7) {
    if (handSize > 6) {
      return selectWithHeuristic(playableCards, gameState, player)
    } else {
      return selectWithMCTS(playableCards, gameState, player, config)
    }
  }

  // 終盤（70-100%）: MCTS（高精度）
  return selectWithMCTS(playableCards, gameState, player, config)
}

/**
 * ゲーム進行度を計算（0.0 - 1.0）
 */
function calculateGameProgress(gameState: GameState): number {
  const totalTricks = 12
  const completedTricks = gameState.tricks.length
  return completedTricks / totalTricks
}

/**
 * ML 推論を優先するラッパー。信頼度が閾値以上かつ手札のカードを返してきた場合のみ
 * その手を採用し、そうでなければ既存の selectAICard にフォールバックする。
 *
 * NEXT_PUBLIC_ML_API_URL 未設定時は ML を呼ばず、即フォールバックするので
 * ローカル開発や ML 無効化環境でも追加コストはない。
 */
export async function selectAICardWithML(
  gameState: GameState,
  player: Player,
  config: AIStrategyConfig
): Promise<Card | null> {
  const playableCards = getPlayableCards(gameState, player.id)
  if (playableCards.length === 0) return null
  if (playableCards.length === 1) {
    logML('skip', `only-1-playable (${playableCards[0].id})`)
    return playableCards[0]
  }

  const mlPick = await tryMLPick(gameState, player, playableCards)
  if (mlPick) return mlPick

  return selectAICard(gameState, player, config)
}

async function tryMLPick(
  gameState: GameState,
  player: Player,
  playableCards: Card[]
): Promise<Card | null> {
  const role: Role = player.isNapoleon
    ? 'napoleon'
    : player.isAdjutant
      ? 'adjutant'
      : 'allied'

  const prediction = await predictBestCard({
    hand: player.hand,
    tableCards: gameState.currentTrick.cards.map((pc) => pc.card),
    currentSuit: gameState.leadingSuit ?? null,
    trumpSuit: gameState.trumpSuit ?? null,
    role,
    isNapoleonTeam: player.isNapoleon || player.isAdjutant,
    trickNumber: gameState.tricks.filter((t) => t.completed).length,
  })

  if (!prediction) {
    logML('fallback', 'no-prediction (URL unset or API error)')
    return null
  }
  if (prediction.confidence < ML_CONFIDENCE_THRESHOLD) {
    logML(
      'fallback',
      `low-confidence (${prediction.confidence.toFixed(3)} < ${ML_CONFIDENCE_THRESHOLD}) primary=${prediction.predictedCardId}`
    )
    return null
  }

  const playableById = new Map(playableCards.map((c) => [c.id, c]))

  // 第一候補を採用 (playable で閾値以上)
  const primary = playableById.get(prediction.predictedCardId)
  if (primary) {
    logML(
      'adopt',
      `${primary.id} confidence=${prediction.confidence.toFixed(3)}`
    )
    return primary
  }

  // 第一候補が手札外/フォロー違反の場合は top-k から playable で閾値以上を探す
  for (let i = 0; i < prediction.topK.length; i++) {
    const candidate = prediction.topK[i]
    if (candidate.confidence < ML_CONFIDENCE_THRESHOLD) break
    const match = playableById.get(candidate.cardId)
    if (match) {
      logML(
        'adopt-topk',
        `${match.id} confidence=${candidate.confidence.toFixed(3)} (rank=${i + 1}, primary=${prediction.predictedCardId} not playable)`
      )
      return match
    }
  }

  logML(
    'fallback',
    `no-playable-candidate (primary=${prediction.predictedCardId} c=${prediction.confidence.toFixed(3)})`
  )
  return null
}

/**
 * 難易度レベルから戦略設定を取得
 */
export function getStrategyConfigByDifficulty(
  difficulty: AIDifficultyLevel
): AIStrategyConfig {
  return DEFAULT_STRATEGY_CONFIGS[difficulty]
}

/**
 * カスタムMCTS設定を作成
 */
export function createCustomMCTSConfig(
  simulationCount: number,
  timeLimit: number,
  determinizationCount: number
): MCTSConfig {
  return {
    simulationCount,
    explorationConstant: Math.sqrt(2),
    timeLimit,
    determinizationCount,
  }
}
