/**
 * 戦略的カード評価システム
 * ナポレオンゲームの特殊ルールと戦略を考慮したAI判断
 */

import {
  isCounterJack as checkIsCounterJack,
  isMighty as checkIsMighty,
  isTrumpJack as checkIsTrumpJack,
  getCardStrength,
} from '@/lib/napoleonCardRules'
import type { Card, GameState, Player, Suit, Trick } from '@/types/game'

/**
 * カードの戦略的価値を評価
 * @param card 評価するカード
 * @param gameState 現在のゲーム状態
 * @param player カードを持つプレイヤー
 * @returns 戦略的価値スコア（高いほど重要）
 */
export function evaluateCardStrategicValue(
  card: Card,
  gameState: GameState,
  player: Player
): number {
  let strategicValue = 0

  // 基本強度を取得
  const baseStrength = getCardStrengthSafe(card, gameState)
  strategicValue += baseStrength

  // 1. 特殊カードボーナス
  if (checkIsMighty(card)) {
    strategicValue += 500 // マイティは最強
  } else if (
    checkIsCounterJack(card, (gameState.trumpSuit as Suit) || 'spades')
  ) {
    strategicValue += 400 // 裏ジャックは強力
  } else if (
    checkIsTrumpJack(card, (gameState.trumpSuit as Suit) || 'spades')
  ) {
    strategicValue += 350 // 表ジャックも強力
  } else if (card.suit === gameState.trumpSuit) {
    strategicValue += 200 // 切り札ボーナス
  }

  // 2. 役割別戦略調整
  if (player.isNapoleon) {
    strategicValue += evaluateNapoleonStrategy(card, gameState)
  } else if (player.isAdjutant) {
    strategicValue += evaluateAdjutantStrategy(card, gameState)
  } else {
    strategicValue += evaluateAllianceStrategy(card, gameState)
  }

  // 3. ゲーム進行状況による調整
  const gameProgress = calculateGameProgress(gameState)
  strategicValue += evaluateGamePhaseStrategy(card, gameProgress, player)

  return strategicValue
}

/**
 * プレイ可能カードから最適なカードを選択
 * @param playableCards プレイ可能なカード配列
 * @param gameState 現在のゲーム状態
 * @param player カードを選択するプレイヤー
 * @returns 選択されたカード
 */
export function selectBestStrategicCard(
  playableCards: Card[],
  gameState: GameState,
  player: Player
): Card | null {
  if (playableCards.length === 0) return null
  if (playableCards.length === 1) return playableCards[0]

  const currentTrick = gameState.currentTrick

  // フォロー義務がない場合（最初のプレイヤー）
  if (currentTrick.cards.length === 0) {
    return selectLeadingCard(playableCards, gameState, player)
  }

  // フォロー義務がある場合
  return selectFollowingCard(playableCards, gameState, player, currentTrick)
}

/**
 * リードカード選択戦略
 */
function selectLeadingCard(
  playableCards: Card[],
  gameState: GameState,
  player: Player
): Card {
  // カードを戦略的価値で評価
  const cardEvaluations = playableCards.map((card) => ({
    card,
    strategicValue: evaluateCardStrategicValue(card, gameState, player),
    leadingStrategy: calculateLeadingStrategy(card, gameState, player),
  }))

  // 役割別のリード戦略
  if (player.isNapoleon) {
    // ナポレオン：強いカードでトリックを取りに行く
    return cardEvaluations.sort(
      (a, b) =>
        b.strategicValue +
        b.leadingStrategy -
        (a.strategicValue + a.leadingStrategy)
    )[0].card
  } else {
    // 連合軍：相手の強いカードを引き出すか、弱いカードで様子見
    const weakCards = cardEvaluations.filter(
      (evaluation) => evaluation.strategicValue < 500
    )
    const strongCards = cardEvaluations.filter(
      (evaluation) => evaluation.strategicValue >= 500
    )

    // 弱いカードがある場合は弱いカードで探り
    if (weakCards.length > 0) {
      return weakCards.sort((a, b) => a.strategicValue - b.strategicValue)[0]
        .card
    }

    // 強いカードしかない場合は最強カードで勝負
    return strongCards.sort((a, b) => b.strategicValue - a.strategicValue)[0]
      .card
  }
}

/**
 * フォローカード選択戦略
 */
function selectFollowingCard(
  playableCards: Card[],
  gameState: GameState,
  player: Player,
  currentTrick: Trick
): Card {
  const leadingCard = currentTrick.cards[0].card
  const leadingSuit = leadingCard.suit

  // 同じスートのカードでフォロー可能かチェック
  const _suitCards = playableCards.filter((card) => card.suit === leadingSuit)
  const canWinTrick = canWinCurrentTrick(playableCards, currentTrick, gameState)

  if (player.isNapoleon) {
    // ナポレオン：可能な限りトリックを取る
    if (canWinTrick) {
      return getLowestWinningCard(playableCards, currentTrick, gameState)
    }
    // 勝てない場合は最弱のカードを出す
    return getWeakestCard(playableCards, gameState)
  } else {
    // 連合軍：ナポレオンにトリックを渡さない戦略
    if (canWinTrick && !isNapoleonWinning(currentTrick, gameState)) {
      return getLowestWinningCard(playableCards, currentTrick, gameState)
    }
    // ナポレオンが勝っている場合や勝てない場合は最弱カード
    return getWeakestCard(playableCards, gameState)
  }
}

/**
 * ナポレオン戦略評価
 */
function evaluateNapoleonStrategy(card: Card, gameState: GameState): number {
  let bonus = 0

  // ナポレオンは積極的に強いカードを使う
  const baseStrength = getCardStrengthSafe(card, gameState)
  if (baseStrength > 700) bonus += 100 // 強いカードにボーナス

  return bonus
}

/**
 * 副官戦略評価
 */
function evaluateAdjutantStrategy(card: Card, gameState: GameState): number {
  let bonus = 0

  // 副官はナポレオンをサポート
  // 中程度の強さのカードを温存
  const baseStrength = getCardStrengthSafe(card, gameState)
  if (baseStrength >= 400 && baseStrength <= 600) bonus += 50

  // 副官指定カードなら早めに出すため大きなボーナス
  const adjutantCard = gameState.napoleonDeclaration?.adjutantCard
  if (adjutantCard && card.id === adjutantCard.id) {
    bonus += 500 // 副官指定カードを優先的に出すための高いボーナス
  }

  return bonus
}

/**
 * 連合軍戦略評価
 */
function evaluateAllianceStrategy(card: Card, gameState: GameState): number {
  let bonus = 0

  // 連合軍はナポレオンを妨害
  // 強いカードは温存、弱いカードで探り
  const baseStrength = getCardStrengthSafe(card, gameState)
  if (baseStrength < 300) bonus += 30 // 弱いカードで探り
  if (baseStrength > 800) bonus += 80 // 強いカードは温存して重要な場面で使用

  return bonus
}

/**
 * ゲーム進行段階による戦略調整
 */
function evaluateGamePhaseStrategy(
  _card: Card,
  gameProgress: number,
  player: Player
): number {
  let bonus = 0

  if (gameProgress < 0.3) {
    // 序盤：情報収集と温存
    bonus += player.isNapoleon ? 20 : -20
  } else if (gameProgress < 0.7) {
    // 中盤：積極的プレイ
    bonus += 30
  } else {
    // 終盤：全力勝負
    bonus += player.isNapoleon ? 50 : 40
  }

  return bonus
}

// ヘルパー関数群
/**
 * ゲーム状態からカードの強度を安全に計算
 */
function getCardStrengthSafe(
  card: Card,
  gameState: GameState,
  leadingSuit?: Suit
): number {
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'
  const effectiveLeadingSuit =
    leadingSuit ||
    (gameState.currentTrick.cards.length > 0
      ? gameState.currentTrick.cards[0].card.suit
      : trumpSuit)

  return getCardStrength(card, trumpSuit, effectiveLeadingSuit as Suit)
}

function calculateGameProgress(gameState: GameState): number {
  const totalTricks = 12 // ナポレオンは12トリック
  const completedTricks = gameState.tricks.length
  return completedTricks / totalTricks
}

function calculateLeadingStrategy(
  card: Card,
  gameState: GameState,
  player: Player
): number {
  // リード時の戦略的価値
  let strategy = 0

  const strength = getCardStrengthSafe(card, gameState)

  if (player.isNapoleon) {
    // ナポレオンは強いカードでリード
    strategy += strength > 600 ? 100 : -50
  } else {
    // 連合軍は探りのための弱いカードまたは決定的な強いカード
    strategy += strength < 300 || strength > 900 ? 100 : -30
  }

  return strategy
}

function canWinCurrentTrick(
  cards: Card[],
  currentTrick: Trick,
  gameState: GameState
): boolean {
  const bestOpponentCard = getBestTrickCard(currentTrick, gameState)
  return cards.some(
    (card) => getCardStrengthSafe(card, gameState) > bestOpponentCard.strength
  )
}

function getBestTrickCard(currentTrick: Trick, gameState: GameState) {
  let bestCard = currentTrick.cards[0].card
  let bestStrength = getCardStrengthSafe(bestCard, gameState)

  for (const trickCard of currentTrick.cards) {
    const strength = getCardStrengthSafe(trickCard.card, gameState)
    if (strength > bestStrength) {
      bestCard = trickCard.card
      bestStrength = strength
    }
  }

  return { card: bestCard, strength: bestStrength }
}

function getLowestWinningCard(
  cards: Card[],
  currentTrick: Trick,
  gameState: GameState
): Card {
  const bestOpponent = getBestTrickCard(currentTrick, gameState)
  const winningCards = cards.filter(
    (card) => getCardStrengthSafe(card, gameState) > bestOpponent.strength
  )

  if (winningCards.length === 0) return cards[0]

  return winningCards.sort(
    (a, b) =>
      getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
  )[0]
}

function getWeakestCard(cards: Card[], gameState: GameState): Card {
  return cards.sort(
    (a, b) =>
      getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
  )[0]
}

function isNapoleonWinning(currentTrick: Trick, gameState: GameState): boolean {
  const napoleon = gameState.players.find((p) => p.isNapoleon)
  if (!napoleon) return false

  const bestCard = getBestTrickCard(currentTrick, gameState)
  return currentTrick.cards.some(
    (trickCard) =>
      trickCard.playerId === napoleon.id && trickCard.card === bestCard.card
  )
}
