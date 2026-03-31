/**
 * Opponent modeling and learning system for Napoleon Game AI
 * 対戦相手モデリングと学習システム
 *
 * Tracks opponent behavior patterns and adapts strategy accordingly
 * 対戦相手の行動パターンを追跡し、それに応じて戦略を適応
 */

import type { Card, GameState, Player, Trick } from '@/types/game'
import { isFaceCard } from './helpers'

/**
 * プレイヤーの性格プロファイル
 * Player personality profile
 */
export interface PlayerProfile {
  playerId: string
  aggressiveness: number // 0-1, 攻撃的 vs 保守的
  riskTolerance: number // 0-1, リスク許容度
  bluffingTendency: number // 0-1, ブラフ傾向
  trumpUsagePattern: 'early' | 'late' | 'balanced' // 切り札使用パターン
  faceCardPreservation: number // 0-1, 絵札温存度
  predictability: number // 0-1, 予測可能性（高いほど読みやすい）
  confidence: number // 0-1, プロファイルの信頼度
}

/**
 * プレイヤーの行動履歴
 * Player action history
 */
export interface PlayerActionHistory {
  playerId: string
  totalTricks: number
  tricksWon: number
  tricksLost: number
  faceCardsPlayed: number
  faceCardsWon: number
  trumpsPlayed: number
  trumpsWonWith: number
  leadPlays: number
  followPlays: number
  aggressivePlays: number // 強いカードで積極的にトリック獲得
  conservativePlays: number // 弱いカードで様子見
  highValueCardsWasted: number // 高価値カードの無駄使い
  bluffAttempts: number // ブラフ試行回数（弱いカードで強気プレイ）
}

/**
 * カードプレイの分析結果
 * Card play analysis result
 */
export interface CardPlayAnalysis {
  wasAggressive: boolean
  wasConservative: boolean
  wasOptimal: boolean
  wasSurprising: boolean // 予想外のプレイ
  riskLevel: 'high' | 'medium' | 'low'
  strategicValue: number
}

/**
 * 相手の予測結果
 * Opponent prediction result
 */
export interface OpponentPrediction {
  playerId: string
  likelyCards: Card[] // 持っている可能性が高いカード
  likelyNextPlay: 'aggressive' | 'conservative' | 'unpredictable'
  expectedStrength: number // 0-1, 予想される手札の強さ
  vulnerabilities: string[] // 弱点（例: "low_trumps", "few_face_cards"）
  confidence: number // 0-1, 予測の信頼度
}

/**
 * 対戦相手モデリングの結果
 * Opponent modeling result
 */
export interface OpponentModelingResult {
  profiles: Map<string, PlayerProfile>
  predictions: Map<string, OpponentPrediction>
  strategicAdjustments: Map<string, number> // playerId -> adjustment bonus
  overallConfidence: number
}

/**
 * プレイヤーの行動履歴を初期化
 * Initialize player action history
 */
export function initializeActionHistory(playerId: string): PlayerActionHistory {
  return {
    playerId,
    totalTricks: 0,
    tricksWon: 0,
    tricksLost: 0,
    faceCardsPlayed: 0,
    faceCardsWon: 0,
    trumpsPlayed: 0,
    trumpsWonWith: 0,
    leadPlays: 0,
    followPlays: 0,
    aggressivePlays: 0,
    conservativePlays: 0,
    highValueCardsWasted: 0,
    bluffAttempts: 0,
  }
}

/**
 * ゲーム状態から全プレイヤーの行動履歴を構築
 * Build action history for all players from game state
 */
export function buildActionHistories(
  gameState: GameState
): Map<string, PlayerActionHistory> {
  const histories = new Map<string, PlayerActionHistory>()

  // 各プレイヤーの履歴を初期化
  for (const player of gameState.players) {
    histories.set(player.id, initializeActionHistory(player.id))
  }

  // 完了したトリックから行動を分析
  for (const trick of gameState.tricks) {
    if (!trick.completed || !trick.winnerPlayerId) continue

    analyzeTrickForHistory(trick, gameState, histories)
  }

  return histories
}

/**
 * トリックから行動履歴を更新
 * Analyze trick and update action histories
 */
function analyzeTrickForHistory(
  trick: Trick,
  gameState: GameState,
  histories: Map<string, PlayerActionHistory>
): void {
  const winnerPlayerId = trick.winnerPlayerId
  if (!winnerPlayerId) return

  const trumpSuit = gameState.trumpSuit

  for (let i = 0; i < trick.cards.length; i++) {
    const trickCard = trick.cards[i]
    const history = histories.get(trickCard.playerId)
    if (!history) continue

    const isWinner = trickCard.playerId === winnerPlayerId
    const isLeader = i === 0
    const card = trickCard.card

    // 基本統計
    history.totalTricks++
    if (isWinner) {
      history.tricksWon++
    } else {
      history.tricksLost++
    }

    if (isLeader) {
      history.leadPlays++
    } else {
      history.followPlays++
    }

    // 絵札プレイ
    if (isFaceCard(card)) {
      history.faceCardsPlayed++
      if (isWinner) {
        history.faceCardsWon++
      }
    }

    // 切り札プレイ
    if (card.suit === trumpSuit) {
      history.trumpsPlayed++
      if (isWinner) {
        history.trumpsWonWith++
      }
    }

    // プレイスタイル分析
    const analysis = analyzeCardPlay(card, trick, gameState, isLeader, isWinner)
    if (analysis.wasAggressive) {
      history.aggressivePlays++
    }
    if (analysis.wasConservative) {
      history.conservativePlays++
    }
    if (analysis.riskLevel === 'high' && !isWinner) {
      history.highValueCardsWasted++
    }
    if (!isWinner && card.value > 10 && !isLeader) {
      // 弱い状況で強いカードを出す = ブラフの可能性
      history.bluffAttempts++
    }
  }
}

/**
 * カードプレイを分析
 * Analyze a card play
 */
function analyzeCardPlay(
  card: Card,
  trick: Trick,
  gameState: GameState,
  isLeader: boolean,
  isWinner: boolean
): CardPlayAnalysis {
  const trumpSuit = gameState.trumpSuit
  const isTrump = card.suit === trumpSuit
  const isFace = isFaceCard(card)

  // 攻撃的プレイ判定
  const wasAggressive =
    (isFace && isLeader) || // 絵札でリード
    (isTrump && !isLeader && card.value >= 12) || // 高価値切り札で介入
    (card.value >= 13 && isWinner) // 高価値カードでトリック獲得

  // 保守的プレイ判定
  const wasConservative =
    (!isFace && isLeader) || // 非絵札でリード
    (!isWinner && card.value <= 9) || // 弱いカードを捨てる
    (!isTrump && !isFace && !isLeader) // 弱いカードでフォロー

  // 最適プレイ判定（簡易版）
  const wasOptimal =
    (isWinner && card.value <= 11) || (!isWinner && card.value <= 9)

  // 予想外のプレイ判定
  const wasSurprising =
    (isFace && !isWinner && !isLeader) || // 絵札を無駄にする
    (isTrump && card.value >= 13 && !isLeader && trick.cards.length === 1) // 2番目で最強切り札

  // リスクレベル
  let riskLevel: 'high' | 'medium' | 'low' = 'low'
  if (isFace || (isTrump && card.value >= 12)) {
    riskLevel = isWinner ? 'medium' : 'high'
  } else if (card.value >= 10) {
    riskLevel = 'medium'
  }

  return {
    wasAggressive,
    wasConservative,
    wasOptimal,
    wasSurprising,
    riskLevel,
    strategicValue: card.value,
  }
}

/**
 * 行動履歴からプレイヤープロファイルを生成
 * Generate player profile from action history
 */
export function generatePlayerProfile(
  history: PlayerActionHistory
): PlayerProfile {
  const totalPlays = history.totalTricks || 1 // ゼロ除算防止

  // 攻撃性: 攻撃的プレイの割合
  const aggressiveness = history.aggressivePlays / totalPlays

  // リスク許容度: 高リスクプレイ（絵札・切り札使用）の割合
  const riskTolerance =
    (history.faceCardsPlayed + history.trumpsPlayed) / totalPlays / 2

  // ブラフ傾向
  const bluffingTendency = history.bluffAttempts / totalPlays

  // 切り札使用パターン
  let trumpUsagePattern: 'early' | 'late' | 'balanced' = 'balanced'
  if (history.trumpsPlayed > 0) {
    const earlyTrumps = history.trumpsPlayed / Math.max(totalPlays / 3, 1)
    if (earlyTrumps > 0.6) {
      trumpUsagePattern = 'early'
    } else if (earlyTrumps < 0.3) {
      trumpUsagePattern = 'late'
    }
  }

  // 絵札温存度: 絵札を勝ちトリックで使う割合
  const faceCardPreservation =
    history.faceCardsPlayed > 0
      ? history.faceCardsWon / history.faceCardsPlayed
      : 0.5

  // 予測可能性: 保守的プレイと攻撃的プレイのバランス
  const playBalance = Math.abs(
    history.aggressivePlays - history.conservativePlays
  )
  const predictability = playBalance / totalPlays

  // 信頼度: データ量に基づく
  const confidence = Math.min(totalPlays / 10, 1)

  return {
    playerId: history.playerId,
    aggressiveness,
    riskTolerance,
    bluffingTendency,
    trumpUsagePattern,
    faceCardPreservation,
    predictability,
    confidence,
  }
}

/**
 * プレイヤープロファイルから予測を生成
 * Generate prediction from player profile
 */
export function generateOpponentPrediction(
  profile: PlayerProfile,
  _player: Player,
  _gameState: GameState
): OpponentPrediction {
  // 次のプレイスタイル予測
  let likelyNextPlay: 'aggressive' | 'conservative' | 'unpredictable' =
    'unpredictable'
  if (profile.confidence > 0.5) {
    if (profile.aggressiveness > 0.6) {
      likelyNextPlay = 'aggressive'
    } else if (profile.aggressiveness < 0.4) {
      likelyNextPlay = 'conservative'
    }
  }

  // 期待される手札の強さ（簡易推定）
  const expectedStrength = (profile.aggressiveness + profile.riskTolerance) / 2

  // 弱点分析
  const vulnerabilities: string[] = []
  if (profile.trumpUsagePattern === 'early') {
    vulnerabilities.push('low_late_game_trumps')
  }
  if (profile.faceCardPreservation < 0.4) {
    vulnerabilities.push('wastes_face_cards')
  }
  if (profile.riskTolerance < 0.3) {
    vulnerabilities.push('too_conservative')
  }
  if (profile.bluffingTendency > 0.3) {
    vulnerabilities.push('frequent_bluffer')
  }
  if (profile.predictability > 0.7) {
    vulnerabilities.push('highly_predictable')
  }

  return {
    playerId: profile.playerId,
    likelyCards: [], // 詳細な手札推定は別途実装可能
    likelyNextPlay,
    expectedStrength,
    vulnerabilities,
    confidence: profile.confidence,
  }
}

/**
 * 対戦相手モデリングのメイン関数
 * Main opponent modeling function
 */
export function analyzeOpponents(
  gameState: GameState,
  currentPlayer: Player
): OpponentModelingResult {
  // 行動履歴を構築
  const histories = buildActionHistories(gameState)

  // プロファイルを生成
  const profiles = new Map<string, PlayerProfile>()
  const predictions = new Map<string, OpponentPrediction>()

  for (const player of gameState.players) {
    if (player.id === currentPlayer.id) continue // 自分自身は除外

    const history = histories.get(player.id)
    if (!history) continue

    const profile = generatePlayerProfile(history)
    const prediction = generateOpponentPrediction(profile, player, gameState)

    profiles.set(player.id, profile)
    predictions.set(player.id, prediction)
  }

  // 戦略調整ボーナスを計算
  const strategicAdjustments = calculateStrategicAdjustments(
    profiles,
    predictions,
    currentPlayer,
    gameState
  )

  // 全体的な信頼度
  let totalConfidence = 0
  let profileCount = 0
  for (const profile of profiles.values()) {
    totalConfidence += profile.confidence
    profileCount++
  }
  const overallConfidence =
    profileCount > 0 ? totalConfidence / profileCount : 0

  return {
    profiles,
    predictions,
    strategicAdjustments,
    overallConfidence,
  }
}

/**
 * プロファイルと予測から戦略調整ボーナスを計算
 * Calculate strategic adjustment bonuses from profiles and predictions
 */
function calculateStrategicAdjustments(
  profiles: Map<string, PlayerProfile>,
  predictions: Map<string, OpponentPrediction>,
  currentPlayer: Player,
  _gameState: GameState
): Map<string, number> {
  const adjustments = new Map<string, number>()

  const isNapoleonTeam = currentPlayer.isNapoleon || currentPlayer.isAdjutant

  for (const [playerId, profile] of profiles) {
    const prediction = predictions.get(playerId)
    if (!prediction || profile.confidence < 0.3) {
      adjustments.set(playerId, 0)
      continue
    }

    let adjustment = 0

    // 予測可能性が高い相手への対策ボーナス
    if (profile.predictability > 0.7) {
      adjustment += 30 * profile.confidence
    }

    // 攻撃的な相手への対策（保守的にプレイ）
    if (profile.aggressiveness > 0.7 && !isNapoleonTeam) {
      adjustment += 20 * profile.confidence // 連合軍は待ち構える
    }

    // 保守的な相手への対策（積極的にプレイ）
    if (profile.aggressiveness < 0.3 && isNapoleonTeam) {
      adjustment += 25 * profile.confidence // ナポレオンは積極的に攻める
    }

    // ブラフが多い相手への対策
    if (profile.bluffingTendency > 0.3) {
      adjustment += 15 * profile.confidence // 慎重に対応
    }

    // 絵札を無駄にする相手への対策
    if (profile.faceCardPreservation < 0.4) {
      adjustment += 20 * profile.confidence // 絵札獲得のチャンス
    }

    adjustments.set(playerId, adjustment)
  }

  return adjustments
}

/**
 * 対戦相手モデリングに基づくカードスコアボーナス
 * Calculate card score bonus based on opponent modeling
 */
export function calculateOpponentModelingBonus(
  card: Card,
  _playableCards: Card[],
  gameState: GameState,
  player: Player,
  modelingResult: OpponentModelingResult
): number {
  if (modelingResult.overallConfidence < 0.3) {
    return 0 // 信頼度が低い場合はボーナスなし
  }

  let bonus = 0
  const trumpSuit = gameState.trumpSuit
  const isTrump = card.suit === trumpSuit
  const isFace = isFaceCard(card)

  // 次のプレイヤーの予測に基づく調整
  const currentPlayerIndex = gameState.players.findIndex(
    (p) => p.id === player.id
  )
  const nextPlayerIndex = (currentPlayerIndex + 1) % gameState.players.length
  const nextPlayer = gameState.players[nextPlayerIndex]
  const nextPrediction = modelingResult.predictions.get(nextPlayer.id)

  if (nextPrediction && nextPrediction.confidence > 0.5) {
    // 次のプレイヤーが攻撃的な場合
    if (nextPrediction.likelyNextPlay === 'aggressive') {
      if (!isFace && !isTrump) {
        bonus += 15 // 弱いカードを先に出す
      }
    }

    // 次のプレイヤーが保守的な場合
    if (nextPrediction.likelyNextPlay === 'conservative') {
      if (isFace || isTrump) {
        bonus += 20 // 強いカードで攻める
      }
    }

    // 次のプレイヤーが切り札を早く使う傾向
    const nextProfile = modelingResult.profiles.get(nextPlayer.id)
    if (nextProfile?.trumpUsagePattern === 'late' && isTrump) {
      bonus += 10 // 切り札で攻めやすい
    }
  }

  // 全体的な戦略調整
  const overallAdjustment =
    Array.from(modelingResult.strategicAdjustments.values()).reduce(
      (sum, adj) => sum + adj,
      0
    ) / Math.max(modelingResult.strategicAdjustments.size, 1)

  bonus += overallAdjustment * 0.3 // 30%を適用

  return bonus * modelingResult.overallConfidence
}

/**
 * 対戦相手モデリング結果のサマリーを取得
 * Get summary of opponent modeling results
 */
export function getOpponentModelingSummary(
  modelingResult: OpponentModelingResult
): string {
  const summaries: string[] = []

  for (const [playerId, profile] of modelingResult.profiles) {
    const prediction = modelingResult.predictions.get(playerId)
    if (!prediction || profile.confidence < 0.3) continue

    const style =
      profile.aggressiveness > 0.6
        ? 'Aggressive'
        : profile.aggressiveness < 0.4
          ? 'Conservative'
          : 'Balanced'

    const risk =
      profile.riskTolerance > 0.6
        ? 'High risk'
        : profile.riskTolerance < 0.4
          ? 'Low risk'
          : 'Moderate risk'

    summaries.push(
      `${playerId}: ${style}, ${risk}, ${prediction.vulnerabilities.length} weaknesses`
    )
  }

  return summaries.join(' | ')
}
