/**
 * Special card strategy functions for AI card selection
 * 特殊カード（Mighty、Jack、Same2）戦略関連の関数
 */

import {
  isCounterJack as checkIsCounterJack,
  isMighty as checkIsMighty,
  isTrumpJack as checkIsTrumpJack,
} from '@/lib/napoleonCardRules'
import type { Card, GameState, Player, Suit, Trick } from '@/types/game'
import { calculateGameProgress, isFaceCard } from './helpers'
import { isNapoleonWinning } from './trumps'
import type { SpecialCardStrategy } from './types'

/**
 * セイム2ポテンシャル評価
 * 切り札以外の2は、そのスートが4枚揃う可能性がある場合に価値が高い
 */
export function evaluateSame2Potential(
  card: Card,
  gameState: GameState
): number {
  // 2以外のカードは評価しない
  if (card.rank !== '2') return 0

  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'

  // 切り札の2はセイム2にならないので評価しない
  if (card.suit === trumpSuit) return 0

  // ゲーム進行度を取得（初旬ほど2を温存すべき）
  const gameProgress = calculateGameProgress(gameState)

  // 現在のトリックを確認
  const currentTrick = gameState.currentTrick

  // トリックが空の場合（リード時）
  if (currentTrick.cards.length === 0) {
    // 🔧 修正: 初旬（0-40%）は2を適度に温存（マイティより低い価値）
    if (gameProgress < 0.4) {
      return 250 // 適度に温存（マイティ+500より低い）
    }
    // 中盤（40-70%）も温存するが、使える場面では使う
    if (gameProgress < 0.7) {
      return 150 // 中程度の温存
    }
    // 終盤はセイム2を作るチャンス（積極的に使う）
    return 50
  }

  // 現在のトリックで異なるスートが出ている場合、そのスートは4枚揃わない
  const leadingSuit = currentTrick.cards[0].card.suit

  // 切り札リードのトリックではセイム2が成立しないので、2は通常の弱札扱い
  // （セイム2ポテンシャルのボーナス/ペナルティを与えない）。
  if (leadingSuit === trumpSuit) return 0

  const allSameSuit = currentTrick.cards.every(
    (pc) => pc.card.suit === leadingSuit
  )

  // トリックにセイム2を無効化するカード（Mighty、Jack）があるかチェック
  const hasSame2Breaker = currentTrick.cards.some(
    (trickCard) =>
      checkIsMighty(trickCard.card) ||
      checkIsTrumpJack(trickCard.card, trumpSuit) ||
      checkIsCounterJack(trickCard.card, trumpSuit)
  )

  // Mighty/Jackが出ていてセイム2が無効化されている場合
  if (hasSame2Breaker) {
    // このトリックで2を出すのは無駄
    // トリック内の位置を考慮（早い段階ほど2を温存すべき）
    const trickPosition = currentTrick.cards.length // 現在何枚出ているか

    // トリックの早い段階（1-2枚目）でMighty/Jackが出ている場合
    // → まだ手札に余裕があるので、2は温存すべき
    if (trickPosition <= 2) {
      // 🔧 修正: ペナルティを緩和（捨てるべき場面では捨てる）
      let penalty = 0
      if (gameProgress < 0.5) {
        penalty = -150 // 序盤は温存（緩和）
      } else if (gameProgress < 0.7) {
        penalty = -100 // 中盤は捨てやすく
      } else {
        penalty = -50 // 終盤は積極的に捨てる
      }

      return penalty
    }

    // トリックの後半（3枚目）でMighty/Jackが出ている場合
    // → 手札が少なくなっているので、捨てても良い
    let penalty = 0
    if (gameProgress < 0.4) {
      penalty = -80 // 序盤でも捨てやすく
    } else if (gameProgress < 0.7) {
      penalty = -50 // 中盤は捨てる傾向
    } else {
      penalty = -20 // 終盤は積極的に捨てる
    }

    return penalty
  }

  // まだ全て同じスートの場合（Mighty/Jackなし）
  if (allSameSuit) {
    // リードスートと同じなら、セイム2の可能性が高い
    if (card.suit === leadingSuit) {
      // 🔧 修正: セイム2発動の可能性があるが、マイティより低い価値
      return 400 // 高ボーナスだが、マイティ（+500）より低い
    }
    // 異なるスートでも、次のトリックで可能性がある
    // 初旬ほど温存
    if (gameProgress < 0.4) {
      return 200 // 適度に温存（マイティより低い）
    }
    return gameProgress < 0.7 ? 100 : 50
  }

  // 異なるスートが混ざっている場合（セイム2無効）
  // このトリックでは使えないが、次のトリックでの可能性を考慮
  // 🔧 修正: セイム2が無効な場合は積極的に捨てる
  if (gameProgress < 0.3) {
    return -30 // 初旬でも捨てやすく
  }
  if (gameProgress < 0.6) {
    return -80 // 中盤は積極的に捨てる
  }
  // 終盤は最優先で捨てる
  return -100
}

/**
 * 4枚揃わないスート評価
 * 現在のトリックで異なるスートが出た場合、そのスートは弱い
 */
export function evaluateNonViableSuit(
  card: Card,
  gameState: GameState
): number {
  const currentTrick = gameState.currentTrick

  // トリックが空か、まだ1枚しか出ていない場合は判定不可
  if (currentTrick.cards.length <= 1) return 0

  const leadingSuit = currentTrick.cards[0].card.suit

  // 異なるスートが出ているかチェック
  const hasDifferentSuit = currentTrick.cards.some(
    (pc) => pc.card.suit !== leadingSuit
  )

  // 異なるスートが出ている = リードスートは4枚揃わない確定
  if (hasDifferentSuit && card.suit === leadingSuit) {
    // リードスートのカードは価値が下がる（捨てる優先度が高い）
    // ただし、絵札や高いカードは別の場面で使えるので、2-5のみペナルティ
    if (['2', '3', '4', '5'].includes(card.rank)) {
      return -50 // 低いカードは捨てる優先度が高い
    }
  }

  return 0
}

/**
 * セイム2無効化カード評価
 * マイティー・ジャックはセイム2を無効化するため、セイム2の可能性があるトリックでは出さない
 */
export function evaluateSame2Breaker(card: Card, gameState: GameState): number {
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'

  // このカードがセイム2を無効化するカードか判定
  const isSame2Breaker =
    checkIsMighty(card) ||
    checkIsTrumpJack(card, trumpSuit) ||
    checkIsCounterJack(card, trumpSuit)

  if (!isSame2Breaker) return 0

  const currentTrick = gameState.currentTrick

  // トリックが空の場合は判定しない
  if (currentTrick.cards.length === 0) return 0

  const leadingSuit = currentTrick.cards[0].card.suit

  // 全て同じスートで、まだセイム2の可能性がある場合
  const allSameSuit = currentTrick.cards.every(
    (pc) => pc.card.suit === leadingSuit
  )

  // まだMighty/Jackが出ていないかチェック
  const alreadyHasSame2Breaker = currentTrick.cards.some(
    (trickCard) =>
      checkIsMighty(trickCard.card) ||
      checkIsTrumpJack(trickCard.card, trumpSuit) ||
      checkIsCounterJack(trickCard.card, trumpSuit)
  )

  // セイム2の可能性があるトリックでMighty/Jackを出すとセイム2を台無しにする。
  // ただし切り札リード時はセイム2が成立しないので、ペナルティを与えない
  // （切り札リードで Mighty / 表J を出すのを過剰に抑制しないため）。
  if (
    allSameSuit &&
    !alreadyHasSame2Breaker &&
    currentTrick.cards.length >= 2 &&
    leadingSuit !== trumpSuit
  ) {
    // ゲーム進行度を取得
    const gameProgress = calculateGameProgress(gameState)

    // 非常に大きなペナルティ（マイティーの+500を上回る）
    // トリックのカード枚数が多いほど（3枚の時）、セイム2の可能性が高いのでペナルティも大きく
    const basePenalty = currentTrick.cards.length >= 3 ? -600 : -450

    // 初旬ほどセイム2の価値が高いので、ペナルティも大きく
    if (gameProgress < 0.4) {
      return basePenalty - 100 // 初旬は特に大きなペナルティ
    }
    if (gameProgress < 0.7) {
      return basePenalty - 50 // 中盤もペナルティ
    }
    return basePenalty // 終盤でもペナルティ
  }

  return 0
}

/**
 * セイム2リスク評価（絵札用）
 * トリックに同じスートが2-3枚出ている状況で、絵札を出すと相手の2に取られるリスクを評価
 */
export function evaluateSame2RiskForFaceCard(
  card: Card,
  gameState: GameState,
  player: Player
): number {
  // 絵札以外は評価しない
  if (!isFaceCard(card)) return 0

  const currentTrick = gameState.currentTrick

  // トリックが空の場合は評価しない
  if (currentTrick.cards.length === 0) return 0

  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'
  const leadingSuit = currentTrick.cards[0].card.suit

  // 切り札は評価しない（セイム2にならない）
  if (card.suit === trumpSuit) return 0

  // 全て同じスートか確認
  const allSameSuit = currentTrick.cards.every(
    (pc) => pc.card.suit === leadingSuit
  )

  // 異なるスートが混ざっている場合、セイム2のリスクなし
  if (!allSameSuit) return 0

  // カードが リードスートと一致するか確認
  if (card.suit !== leadingSuit) return 0

  // Mighty/Jackが出ている場合、セイム2は発動しない
  const hasSame2Breaker = currentTrick.cards.some(
    (trickCard) =>
      checkIsMighty(trickCard.card) ||
      checkIsTrumpJack(trickCard.card, trumpSuit) ||
      checkIsCounterJack(trickCard.card, trumpSuit)
  )
  if (hasSame2Breaker) return 0

  // トリックの枚数を確認（2-3枚の時がセイム2リスク）
  const trickCardCount = currentTrick.cards.length

  // 2枚または3枚の時、4枚目で絵札を出すと相手の2に取られるリスク
  if (trickCardCount >= 2 && trickCardCount <= 3) {
    // 例外: 意図的に絵札を渡す戦略の場合は適用しない
    // ナポレオンが既に勝っている場合（副官が絵札を渡す戦略）
    if (player.isAdjutant && isNapoleonWinning(currentTrick, gameState)) {
      return 0 // 絵札を渡す戦略なのでペナルティなし
    }

    // ゲーム進行度を取得
    const gameProgress = calculateGameProgress(gameState)

    // セイム2リスクのペナルティ
    // 3枚目（4枚揃う可能性が非常に高い）の方が危険
    const baseRiskPenalty = trickCardCount === 3 ? -250 : -150

    // トリックに既に絵札がたくさんある場合、リスクが高い
    const faceCardsInTrick = currentTrick.cards.filter((tc) =>
      isFaceCard(tc.card)
    ).length

    // 絵札が多いほどリスク大（取られる絵札が増える）
    const faceCardMultiplier = faceCardsInTrick >= 2 ? 1.5 : 1.0

    // 序盤・中盤ほどリスク回避すべき
    let finalPenalty = baseRiskPenalty * faceCardMultiplier
    if (gameProgress < 0.4) {
      finalPenalty *= 1.3 // 序盤は特にリスク回避
    } else if (gameProgress < 0.7) {
      finalPenalty *= 1.1 // 中盤もリスク回避
    }

    return Math.round(finalPenalty)
  }

  return 0
}

/**
 * 特殊カード戦略を評価
 * Mighty、Trump Jack、Counter Jackの使用タイミングを最適化
 */
export function evaluateSpecialCardStrategy(
  player: Player,
  playableCards: Card[],
  currentTrick: Trick,
  gameState: GameState,
  calculateWinningRequirements: (gameState: GameState) => {
    napoleonNeedsToWin: number
  }
): SpecialCardStrategy {
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'

  // 自分の特殊カードを検出
  const mightyCard = playableCards.find((card) => checkIsMighty(card)) || null
  const trumpJackCard =
    playableCards.find((card) => checkIsTrumpJack(card, trumpSuit)) || null
  const counterJackCard =
    playableCards.find((card) => checkIsCounterJack(card, trumpSuit)) || null

  const hasMighty = mightyCard !== null
  const hasTrumpJack = trumpJackCard !== null
  const hasCounterJack = counterJackCard !== null

  // トリック内の絵札数を計算
  const faceCardsInTrick = currentTrick.cards.filter((tc) =>
    isFaceCard(tc.card)
  ).length

  // セイム2のリスクを評価
  const leadingSuit = currentTrick.leadingSuit || gameState.leadingSuit
  const allSameSuit = leadingSuit
    ? currentTrick.cards.every((tc) => tc.card.suit === leadingSuit)
    : false

  // トリック内に既に特殊カードがあるかチェック
  const alreadyHasSpecialCard = currentTrick.cards.some(
    (tc) =>
      checkIsMighty(tc.card) ||
      checkIsTrumpJack(tc.card, trumpSuit) ||
      checkIsCounterJack(tc.card, trumpSuit)
  )

  // セイム2リスク: 全て同じスートで特殊カードがまだ出ていない場合
  // 切り札リード時はセイム2が成立しない（napoleonCardRules.checkSame2Conditions:
  // leadingSuit === trumpSuit は無効）ため、リスク扱いしない。これを怠ると
  // 切り札リードのトリックで Mighty / 表J の使用が誤ってブロックされる。
  const hasSame2Risk =
    allSameSuit &&
    !alreadyHasSpecialCard &&
    currentTrick.cards.length >= 2 &&
    leadingSuit !== trumpSuit

  // Mighty使用判断
  let shouldUseMighty = false
  if (hasMighty) {
    // セイム2のリスクがある場合は使わない（セイム2を壊さない）
    if (!hasSame2Risk) {
      // 絵札が3枚以上ある重要なトリックで使用
      if (faceCardsInTrick >= 3) {
        shouldUseMighty = true
      }
      // 終盤（残り3トリック以下）で絵札が2枚以上ある場合
      const remainingTricks = 12 - gameState.tricks.length
      if (remainingTricks <= 3 && faceCardsInTrick >= 2) {
        shouldUseMighty = true
      }
      // ナポレオンチームで目標達成に必要な場合
      if (player.isNapoleon || player.isAdjutant) {
        const requirements = calculateWinningRequirements(gameState)
        if (requirements.napoleonNeedsToWin <= 2 && faceCardsInTrick >= 1) {
          shouldUseMighty = true
        }
      }
    }
  }

  // Trump Jack使用判断
  let shouldUseTrumpJack = false
  if (hasTrumpJack) {
    // セイム2のリスクがある場合は使わない
    if (!hasSame2Risk) {
      // Mightyがない場合、Trump Jackを切り札として使用
      if (!hasMighty && faceCardsInTrick >= 2) {
        shouldUseTrumpJack = true
      }
      // 終盤で必要な場合
      const remainingTricks = 12 - gameState.tricks.length
      if (remainingTricks <= 2 && faceCardsInTrick >= 1) {
        shouldUseTrumpJack = true
      }
    }
  }

  // Counter Jack使用判断
  let shouldUseCounterJack = false
  if (hasCounterJack) {
    // セイム2のリスクがある場合は使わない
    if (!hasSame2Risk) {
      // 絵札が多い場合に使用
      if (faceCardsInTrick >= 2) {
        shouldUseCounterJack = true
      }
      // 連合軍でナポレオンをブロックする必要がある場合
      if (!player.isNapoleon && !player.isAdjutant) {
        const napoleonWinning = currentTrick.cards.some((tc) => {
          const p = gameState.players.find((pl) => pl.id === tc.playerId)
          return p && (p.isNapoleon || p.isAdjutant)
        })
        if (napoleonWinning && faceCardsInTrick >= 1) {
          shouldUseCounterJack = true
        }
      }
    }
  }

  return {
    hasMighty,
    hasTrumpJack,
    hasCounterJack,
    mightyCard,
    trumpJackCard,
    counterJackCard,
    shouldUseMighty,
    shouldUseTrumpJack,
    shouldUseCounterJack,
    faceCardsInTrick,
    hasSame2Risk,
  }
}
