/**
 * Signal encoding functions for AI card selection
 * カード選択を通じたシグナル送信機能
 */

import type { Card, GameState, Player, Suit, Trick } from '@/types/game'
import { calculateGameProgress, getCardStrengthSafe } from './helpers'
import type { Signal, SignalHistory, SignalType } from './types'

/**
 * カード選択に基づいてシグナルをエンコード
 * 特定のカードを選ぶことで、パートナーに意図を伝える
 */
export function encodeSignal(
  card: Card,
  playableCards: Card[],
  currentTrick: Trick,
  gameState: GameState,
  player: Player,
  signalType: SignalType
): Signal | null {
  const trickNumber = gameState.tricks.length

  // シグナルの基本構造を作成
  const baseSignal: Omit<Signal, 'strength' | 'confidence'> = {
    type: signalType,
    trickNumber,
    playerId: player.id,
  }

  // シグナルタイプに応じた強度と信頼度を計算
  switch (signalType) {
    case 'SUIT_STRENGTH': {
      const strength = evaluateSuitStrengthSignal(
        card,
        playableCards,
        gameState
      )
      return {
        ...baseSignal,
        strength: strength.level,
        suit: card.suit,
        confidence: strength.confidence,
      }
    }

    case 'VOID_SUIT': {
      // ボイドシグナルは切り札を出すことで示す
      const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'
      if (card.suit === trumpSuit && currentTrick.leadingSuit !== trumpSuit) {
        return {
          ...baseSignal,
          strength: 'STRONG',
          suit: currentTrick.leadingSuit || undefined,
          confidence: 0.9,
        }
      }
      return null
    }

    case 'TRUMP_STRENGTH': {
      const strength = evaluateTrumpStrengthSignal(
        card,
        playableCards,
        gameState
      )
      return {
        ...baseSignal,
        strength: strength.level,
        confidence: strength.confidence,
      }
    }

    case 'FACE_CARD_COUNT': {
      const strength = evaluateFaceCardSignal(card, player, gameState)
      return {
        ...baseSignal,
        strength: strength.level,
        confidence: strength.confidence,
      }
    }

    case 'NEED_HELP':
    case 'CAN_WIN':
    case 'BLOCK_NAPOLEON':
    case 'SUPPORT_NAPOLEON': {
      // これらはより高レベルな戦略シグナル
      const strength = evaluateStrategicSignal(
        card,
        playableCards,
        currentTrick,
        gameState,
        signalType
      )
      return {
        ...baseSignal,
        strength: strength.level,
        confidence: strength.confidence,
      }
    }

    default:
      return null
  }
}

/**
 * シグナルを送るべきか判断
 * ゲーム進行度、手札状況、過去のシグナル履歴から判断
 */
export function shouldSendSignal(
  playableCards: Card[],
  currentTrick: Trick,
  gameState: GameState,
  _player: Player,
  signalHistory: SignalHistory
): boolean {
  const gameProgress = calculateGameProgress(gameState)
  const trickNumber = gameState.tricks.length

  // 序盤（最初の2トリック）はシグナルを送らない
  if (trickNumber < 2) return false

  // リードする時はシグナルの必要性が低い
  if (currentTrick.cards.length === 0) return false

  // 終盤（残り2トリック以下）は状況が明確なのでシグナル不要
  const remainingTricks = 12 - trickNumber
  if (remainingTricks <= 2) return false

  // 最近シグナルを送った場合は控える（過度なシグナリングを防ぐ）
  const recentSignals = signalHistory.sentSignals.filter(
    (s) => s.trickNumber >= trickNumber - 2
  )
  if (recentSignals.length >= 2) return false

  // 中盤（30-70%）はシグナルが最も効果的
  if (gameProgress >= 0.3 && gameProgress <= 0.7) {
    return playableCards.length >= 2 // 選択肢がある時のみ
  }

  // それ以外は状況に応じて
  return playableCards.length >= 3 // より多くの選択肢がある時のみ
}

/**
 * 特定のシグナルを送るためのカードを選択
 * 送りたいシグナルに最も適したカードを選ぶ
 */
export function selectSignalCard(
  playableCards: Card[],
  signalToSend: Signal,
  _currentTrick: Trick,
  gameState: GameState
): Card | null {
  if (playableCards.length === 0) return null
  if (playableCards.length === 1) return playableCards[0]

  const { type, strength, suit } = signalToSend

  switch (type) {
    case 'SUIT_STRENGTH': {
      // スートの強さを示す：そのスートの強いカードを出す
      if (!suit) return null
      const suitCards = playableCards.filter((c) => c.suit === suit)
      if (suitCards.length === 0) return null

      // 強度に応じたカードを選択
      const sorted = suitCards.sort(
        (a, b) =>
          getCardStrengthSafe(b, gameState) - getCardStrengthSafe(a, gameState)
      )

      if (strength === 'STRONG') return sorted[0] // 最強
      if (strength === 'MODERATE') return sorted[Math.floor(sorted.length / 2)] // 中間
      return sorted[sorted.length - 1] // 最弱
    }

    case 'TRUMP_STRENGTH': {
      // 切り札の強さを示す
      const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'
      const trumpCards = playableCards.filter((c) => c.suit === trumpSuit)
      if (trumpCards.length === 0) return null

      const sorted = trumpCards.sort(
        (a, b) =>
          getCardStrengthSafe(b, gameState) - getCardStrengthSafe(a, gameState)
      )

      if (strength === 'STRONG') return sorted[0]
      if (strength === 'MODERATE') return sorted[Math.floor(sorted.length / 2)]
      return sorted[sorted.length - 1]
    }

    case 'CAN_WIN': {
      // 勝てることを示す：最強カードを出す
      return playableCards.sort(
        (a, b) =>
          getCardStrengthSafe(b, gameState) - getCardStrengthSafe(a, gameState)
      )[0]
    }

    case 'NEED_HELP': {
      // 助けが必要：弱いカードを出す
      return playableCards.sort(
        (a, b) =>
          getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
      )[0]
    }

    default:
      return null
  }
}

/**
 * スートの強さシグナルを評価
 */
function evaluateSuitStrengthSignal(
  card: Card,
  playableCards: Card[],
  gameState: GameState
): { level: Signal['strength']; confidence: number } {
  const suitCards = playableCards.filter((c) => c.suit === card.suit)
  if (suitCards.length === 0) return { level: 'NONE', confidence: 0 }

  const cardStrength = getCardStrengthSafe(card, gameState)
  const avgStrength =
    suitCards.reduce((sum, c) => sum + getCardStrengthSafe(c, gameState), 0) /
    suitCards.length

  // カードが平均より大幅に強い場合、強いシグナル
  if (cardStrength > avgStrength * 1.5) {
    return { level: 'STRONG', confidence: 0.8 }
  }
  if (cardStrength > avgStrength * 1.2) {
    return { level: 'MODERATE', confidence: 0.6 }
  }
  if (cardStrength < avgStrength * 0.8) {
    return { level: 'WEAK', confidence: 0.6 }
  }

  return { level: 'NONE', confidence: 0.3 }
}

/**
 * 切り札の強さシグナルを評価
 */
function evaluateTrumpStrengthSignal(
  card: Card,
  _playableCards: Card[],
  gameState: GameState
): { level: Signal['strength']; confidence: number } {
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'
  if (card.suit !== trumpSuit) return { level: 'NONE', confidence: 0 }

  const strength = getCardStrengthSafe(card, gameState)

  // 切り札の強度を判定
  if (strength > 900) return { level: 'STRONG', confidence: 0.9 } // Mighty級
  if (strength > 700) return { level: 'STRONG', confidence: 0.8 } // A, K級
  if (strength > 500) return { level: 'MODERATE', confidence: 0.7 } // Q, J級
  if (strength > 300) return { level: 'WEAK', confidence: 0.6 } // 数札

  return { level: 'WEAK', confidence: 0.5 }
}

/**
 * 絵札数シグナルを評価
 */
function evaluateFaceCardSignal(
  _card: Card,
  player: Player,
  _gameState: GameState
): { level: Signal['strength']; confidence: number } {
  const faceCards = player.hand.filter((c) =>
    ['A', 'K', 'Q', 'J', '10'].includes(c.rank)
  )
  const faceCardCount = faceCards.length

  // 絵札が多いほど強いシグナル
  if (faceCardCount >= 5) return { level: 'STRONG', confidence: 0.8 }
  if (faceCardCount >= 3) return { level: 'MODERATE', confidence: 0.7 }
  if (faceCardCount >= 1) return { level: 'WEAK', confidence: 0.6 }

  return { level: 'NONE', confidence: 0.3 }
}

/**
 * 戦略的シグナルを評価
 */
function evaluateStrategicSignal(
  card: Card,
  playableCards: Card[],
  _currentTrick: Trick,
  gameState: GameState,
  signalType: SignalType
): { level: Signal['strength']; confidence: number } {
  const cardStrength = getCardStrengthSafe(card, gameState)

  switch (signalType) {
    case 'CAN_WIN': {
      // 最強カードなら強いシグナル
      const maxStrength = Math.max(
        ...playableCards.map((c) => getCardStrengthSafe(c, gameState))
      )
      if (cardStrength === maxStrength) {
        return { level: 'STRONG', confidence: 0.9 }
      }
      return { level: 'MODERATE', confidence: 0.5 }
    }

    case 'NEED_HELP': {
      // 弱いカードなら助けが必要のシグナル
      const minStrength = Math.min(
        ...playableCards.map((c) => getCardStrengthSafe(c, gameState))
      )
      if (cardStrength === minStrength) {
        return { level: 'STRONG', confidence: 0.8 }
      }
      return { level: 'MODERATE', confidence: 0.5 }
    }

    case 'BLOCK_NAPOLEON':
    case 'SUPPORT_NAPOLEON': {
      // これらは状況依存なので中程度の信頼度
      return { level: 'MODERATE', confidence: 0.6 }
    }

    default:
      return { level: 'NONE', confidence: 0 }
  }
}
