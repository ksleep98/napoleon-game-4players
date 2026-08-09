/**
 * Napoleon-Adjutant cooperation and signaling enhancement
 * ナポレオン・副官チームの協力強化とシグナリング機能
 */

import type { Card, GameState, Player, Suit, Trick } from '@/types/game'
import { evaluateAdjutantTactics } from './adjutantTactics'
import {
  calculateGameProgress,
  getCardStrengthSafe,
  isFaceCard,
} from './helpers'
import { getWinningCards as getWinningCardsWithSpecialRules } from './trickOutcome'
import type {
  AdjutantTacticalInfo,
  CardCountingInfo,
  CooperativeStrategyInfo,
  Signal,
  SignalHistory,
  WinningRequirements,
} from './types'

/**
 * ナポレオンチームの協力戦略を評価
 * Napoleon and Adjutant cooperation with signaling enhancement
 */
export function evaluateNapoleonCooperation(
  playableCards: Card[],
  currentTrick: Trick,
  gameState: GameState,
  player: Player,
  signalHistory: SignalHistory,
  _cardCounting: CardCountingInfo,
  requirements: WinningRequirements
): CooperativeStrategyInfo {
  // パートナーからのシグナルを抽出
  const partnerSignals = extractNapoleonPartnerSignals(
    player,
    signalHistory,
    gameState
  )

  // シグナルを送るべきか判断
  const shouldSignal = shouldSendNapoleonSignal(
    playableCards,
    currentTrick,
    gameState,
    player,
    signalHistory,
    requirements
  )

  // 協調プレイカードを提案
  const coordinatedPlay = selectCoordinatedNapoleonCard(
    playableCards,
    currentTrick,
    gameState,
    player,
    partnerSignals,
    requirements
  )

  // 協力ボーナスを計算
  const cooperationBonus = calculateNapoleonCooperationBonus(
    coordinatedPlay,
    partnerSignals,
    gameState,
    player,
    requirements
  )

  // 理由を構築
  const reasoning = buildNapoleonCooperationReasoning(
    coordinatedPlay,
    partnerSignals,
    gameState,
    player,
    shouldSignal
  )

  return {
    shouldSignal,
    signalToSend: undefined, // エンコーダーで生成
    partnerSignals,
    coordinatedPlay: coordinatedPlay || undefined,
    reasoning,
    cooperationBonus,
  }
}

/**
 * 副官の戦術をシグナル情報で強化
 * Enhance adjutant tactics with Napoleon's signals
 */
export function enhanceAdjutantCoordination(
  adjutantTactics: AdjutantTacticalInfo,
  napoleonSignals: Signal[],
  _gameState: GameState
): AdjutantTacticalInfo {
  const enhanced = { ...adjutantTactics }

  // ナポレオンからのCAN_WINシグナル: 絵札を渡すのを控える
  const canWinSignals = napoleonSignals.filter(
    (s) => s.type === 'CAN_WIN' && s.strength === 'STRONG'
  )
  if (canWinSignals.length > 0) {
    enhanced.shouldPassFaceCard = false // ナポレオンが自力で勝てる場合は絵札を渡さない
  }

  // ナポレオンからのNEED_HELPシグナル: より積極的にサポート
  const needHelpSignals = napoleonSignals.filter(
    (s) => s.type === 'NEED_HELP' && s.strength === 'STRONG'
  )
  if (needHelpSignals.length > 0) {
    enhanced.shouldWinForNapoleon = true // ナポレオンが助けを必要としている
    enhanced.shouldProtectNapoleon = true // 保護を強化
  }

  // ナポレオンからのSUPPORT_NAPOLEONシグナル: 副官が積極的にプレイ
  const supportSignals = napoleonSignals.filter(
    (s) => s.type === 'SUPPORT_NAPOLEON' && s.strength === 'STRONG'
  )
  if (supportSignals.length > 0) {
    enhanced.shouldWinForNapoleon = true // サポート要請に応える
  }

  // ナポレオンからのTRUMP_STRENGTHシグナル: 切り札が強い
  const trumpStrengthSignals = napoleonSignals.filter(
    (s) => s.type === 'TRUMP_STRENGTH' && s.strength === 'STRONG'
  )
  if (trumpStrengthSignals.length > 0) {
    // ナポレオンが強い切り札を持っている場合、副官は切り札を温存
    // この情報は戦術に影響を与える
    enhanced.napoleonIsWinning = true // ナポレオンの勝利可能性を上方修正
  }

  return enhanced
}

/**
 * ナポレオンチームのパートナーシグナルを抽出
 * Extract signals from Napoleon or Adjutant partner
 */
function extractNapoleonPartnerSignals(
  player: Player,
  signalHistory: SignalHistory,
  gameState: GameState
): Signal[] {
  const signals: Signal[] = []

  if (player.isNapoleon) {
    // ナポレオン: 副官からのシグナルを抽出
    const adjutant = gameState.players.find((p) => p.isAdjutant)
    if (adjutant) {
      const adjutantSignals = signalHistory.receivedSignals.filter(
        (s) => s.playerId === adjutant.id
      )
      signals.push(...adjutantSignals)
    }
  } else if (player.isAdjutant) {
    // 副官: ナポレオンからのシグナルを抽出
    const napoleon = gameState.players.find((p) => p.isNapoleon)
    if (napoleon) {
      const napoleonSignals = signalHistory.receivedSignals.filter(
        (s) => s.playerId === napoleon.id
      )
      signals.push(...napoleonSignals)
    }
  }

  return signals
}

/**
 * ナポレオンチームがシグナルを送るべきか判断
 * Determine if Napoleon team should send signals
 */
function shouldSendNapoleonSignal(
  playableCards: Card[],
  currentTrick: Trick,
  gameState: GameState,
  player: Player,
  signalHistory: SignalHistory,
  requirements: WinningRequirements
): boolean {
  const gameProgress = calculateGameProgress(gameState)
  const trickNumber = gameState.tricks.length

  // 序盤（最初の2トリック）はシグナルを控える
  if (trickNumber < 2) return false

  // リードする時はシグナルの必要性が低い
  if (currentTrick.cards.length === 0) return false

  // 終盤（残り2トリック以下）は状況が明確なのでシグナル不要
  if (requirements.remainingTricks <= 2) return false

  // 最近シグナルを送った場合は控える
  const recentSignals = signalHistory.sentSignals.filter(
    (s) => s.trickNumber >= trickNumber - 2
  )
  if (recentSignals.length >= 2) return false

  // 中盤（30-70%）はシグナルが効果的
  if (gameProgress >= 0.3 && gameProgress <= 0.7) {
    return playableCards.length >= 2 // 選択肢がある時のみ
  }

  // クリティカルフェーズ（目標達成が危うい）はシグナルを送る
  if (requirements.isCriticalPhase && player.isNapoleon) {
    return playableCards.length >= 2
  }

  // それ以外は選択肢が多い時のみ
  return playableCards.length >= 3
}

/**
 * 協調プレイのためのカードを選択
 * Select card for coordinated Napoleon team play
 */
function selectCoordinatedNapoleonCard(
  playableCards: Card[],
  currentTrick: Trick,
  gameState: GameState,
  player: Player,
  partnerSignals: Signal[],
  requirements: WinningRequirements
): Card | null {
  if (playableCards.length === 0) return null
  if (playableCards.length === 1) return playableCards[0]

  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'

  // 副官の場合、既存のevaluateAdjutantTactics()を活用
  if (player.isAdjutant) {
    const napoleon = gameState.players.find((p) => p.isNapoleon)
    if (!napoleon) return null

    // ナポレオンからのシグナルを抽出
    const napoleonSignals = partnerSignals.filter(
      (s) => s.playerId === napoleon.id
    )

    // 既存の副官戦術を評価
    const adjutantTactics = evaluateAdjutantTactics(
      playableCards,
      currentTrick,
      gameState,
      requirements,
      player.hand
    )

    // シグナルで強化
    const enhancedTactics = enhanceAdjutantCoordination(
      adjutantTactics,
      napoleonSignals,
      gameState
    )

    // 0. ナポレオンの副官呼びに応える（副官カードで実際に取れる場合）
    // この協調経路は selectFollowingCard より先に評価されるため、
    // ここにも同じ判定を置かないと呼び応答が握り潰される。
    if (
      enhancedTactics.shouldAnswerAdjutantCall &&
      enhancedTactics.adjutantCallCard
    ) {
      return enhancedTactics.adjutantCallCard
    }

    // 1. 副官カード早期開示（最適なタイミング）
    if (enhancedTactics.shouldRevealNow && enhancedTactics.adjutantCard) {
      return enhancedTactics.adjutantCard
    }

    // 2. ナポレオンに絵札を渡す（シグナル強化版）
    if (enhancedTactics.shouldPassFaceCard && enhancedTactics.faceCardToPass) {
      return enhancedTactics.faceCardToPass
    }

    // 3. ナポレオンのために積極的に勝つ（NEED_HELPシグナル対応）
    if (enhancedTactics.shouldWinForNapoleon) {
      const winningCards = getWinningCards(
        playableCards,
        currentTrick,
        gameState
      )
      if (winningCards.length > 0) {
        // 最も弱い勝てるカードを使う
        return winningCards.sort(
          (a, b) =>
            getCardStrengthSafe(a, gameState) -
            getCardStrengthSafe(b, gameState)
        )[0]
      }
    }

    // 4. ナポレオン保護（シグナル強化版）
    if (enhancedTactics.shouldProtectNapoleon) {
      const winningCards = getWinningCards(
        playableCards,
        currentTrick,
        gameState
      )
      if (winningCards.length > 0) {
        return winningCards.sort(
          (a, b) =>
            getCardStrengthSafe(a, gameState) -
            getCardStrengthSafe(b, gameState)
        )[0]
      }
    }
  }

  // ナポレオンの場合、副官からのシグナルを活用
  if (player.isNapoleon) {
    const adjutant = gameState.players.find((p) => p.isAdjutant)
    if (adjutant) {
      const adjutantSignals = partnerSignals.filter(
        (s) => s.playerId === adjutant.id
      )

      // 副官からのTRUMP_STRENGTHシグナル: 副官が強い切り札を持っている
      const adjutantTrumpSignals = adjutantSignals.filter(
        (s) => s.type === 'TRUMP_STRENGTH' && s.strength === 'STRONG'
      )
      if (adjutantTrumpSignals.length > 0) {
        // 副官に切り札を使わせるため、非切り札のリードを優先
        const nonTrumpCards = playableCards.filter(
          (card) => card.suit !== trumpSuit
        )
        if (nonTrumpCards.length > 0 && currentTrick.cards.length === 0) {
          // リード時に非切り札を出す
          const faceCards = nonTrumpCards.filter(isFaceCard)
          if (faceCards.length > 0) {
            // 絵札がある非切り札スートでリード（副官が切り札で勝つチャンス）
            return faceCards.sort(
              (a, b) =>
                getCardStrengthSafe(b, gameState) -
                getCardStrengthSafe(a, gameState)
            )[0]
          }
        }
      }

      // 副官からのCAN_WINシグナル: 副官が勝てる
      const canWinSignals = adjutantSignals.filter(
        (s) => s.type === 'CAN_WIN' && s.strength === 'STRONG'
      )
      if (canWinSignals.length > 0 && currentTrick.cards.length > 0) {
        // 副官が勝てる場合、ナポレオンは絵札を出して副官に渡す
        const faceCards = playableCards.filter(isFaceCard)
        if (faceCards.length > 0) {
          // 弱い絵札を出す（副官に渡す）
          return faceCards.sort(
            (a, b) =>
              getCardStrengthSafe(a, gameState) -
              getCardStrengthSafe(b, gameState)
          )[0]
        }
      }

      // 副官からのSUIT_STRENGTHシグナル: 特定のスートが強い
      const suitStrengthSignals = adjutantSignals.filter(
        (s) => s.type === 'SUIT_STRENGTH' && s.strength === 'STRONG'
      )
      if (suitStrengthSignals.length > 0 && currentTrick.cards.length === 0) {
        // 副官が強いスートがあれば、そのスートでリード
        for (const signal of suitStrengthSignals) {
          if (!signal.suit) continue
          const cardsInSuit = playableCards.filter(
            (card) => card.suit === signal.suit
          )
          if (cardsInSuit.length > 0) {
            // そのスートの弱いカード（または中程度）でリード
            return cardsInSuit.sort(
              (a, b) =>
                getCardStrengthSafe(a, gameState) -
                getCardStrengthSafe(b, gameState)
            )[0]
          }
        }
      }
    }
  }

  return null
}

/**
 * ナポレオンチーム協力ボーナスを計算
 * Calculate cooperation bonus for Napoleon team
 */
function calculateNapoleonCooperationBonus(
  coordinatedPlay: Card | null,
  partnerSignals: Signal[],
  gameState: GameState,
  player: Player,
  requirements: WinningRequirements
): number {
  let bonus = 0

  // 協調プレイが推奨されている場合
  if (coordinatedPlay) {
    const cardStrength = getCardStrengthSafe(coordinatedPlay, gameState)

    // 副官カード開示ボーナス
    const adjutantCardId = gameState.napoleonDeclaration?.adjutantCard?.id
    if (coordinatedPlay.id === adjutantCardId) {
      bonus += 200 // 副官カード開示は最優先
    }

    // 絵札を渡すボーナス（副官 → ナポレオン）
    if (player.isAdjutant && isFaceCard(coordinatedPlay)) {
      bonus += 120
    }

    // 絵札を渡すボーナス（ナポレオン → 副官）
    if (player.isNapoleon && isFaceCard(coordinatedPlay)) {
      bonus += 100
    }

    // 協調的な勝利ボーナス
    if (cardStrength > 700) {
      bonus += 80 // 強いカードで協調
    }
  }

  // パートナーシグナルに基づくボーナス
  for (const signal of partnerSignals) {
    // CAN_WINシグナル: パートナーに任せる
    if (signal.type === 'CAN_WIN' && signal.strength === 'STRONG') {
      bonus += 60 // パートナーに任せる戦略
    }

    // NEED_HELPシグナル: サポート強化
    if (signal.type === 'NEED_HELP' && signal.strength === 'STRONG') {
      bonus += 80 // 積極的にサポート
    }

    // TRUMP_STRENGTHシグナル: 切り札の協調
    if (signal.type === 'TRUMP_STRENGTH' && signal.strength === 'STRONG') {
      bonus += 50 // 切り札を活用
    }

    // SUIT_STRENGTHシグナル: スートの協調
    if (signal.type === 'SUIT_STRENGTH' && signal.strength === 'STRONG') {
      bonus += 40 // スートを活用
    }
  }

  // クリティカルフェーズでの協力ボーナス
  if (requirements.isCriticalPhase) {
    bonus += 30 // 重要局面での協力
  }

  // 基本的な協力モニタリングボーナス
  if (partnerSignals.length > 0) {
    bonus += 20 // シグナルを受信している
  }

  return bonus
}

/**
 * ナポレオンチーム協力の理由を構築
 * Build reasoning for Napoleon team cooperation
 */
function buildNapoleonCooperationReasoning(
  coordinatedPlay: Card | null,
  partnerSignals: Signal[],
  gameState: GameState,
  _player: Player,
  shouldSignal: boolean
): string {
  const reasons: string[] = []

  if (coordinatedPlay) {
    const adjutantCardId = gameState.napoleonDeclaration?.adjutantCard?.id
    if (coordinatedPlay.id === adjutantCardId) {
      reasons.push('adjutant card reveal')
    } else if (isFaceCard(coordinatedPlay)) {
      reasons.push('passing face card to partner')
    } else {
      reasons.push('coordinated play')
    }
  }

  // パートナーシグナルの要約
  const canWinCount = partnerSignals.filter(
    (s) => s.type === 'CAN_WIN' && s.strength === 'STRONG'
  ).length
  const needHelpCount = partnerSignals.filter(
    (s) => s.type === 'NEED_HELP' && s.strength === 'STRONG'
  ).length
  const trumpStrengthCount = partnerSignals.filter(
    (s) => s.type === 'TRUMP_STRENGTH' && s.strength === 'STRONG'
  ).length

  if (canWinCount > 0) reasons.push(`partner can win (${canWinCount})`)
  if (needHelpCount > 0) reasons.push(`partner needs help (${needHelpCount})`)
  if (trumpStrengthCount > 0)
    reasons.push(`partner trump strength (${trumpStrengthCount})`)

  if (shouldSignal) {
    reasons.push('sending signal')
  }

  if (reasons.length === 0) {
    reasons.push('standard napoleon team play')
  }

  return reasons.join(', ')
}

/**
 * 勝てるカードを取得
 * Get winning cards from playable cards
 */
function getWinningCards(
  playableCards: Card[],
  currentTrick: Trick,
  gameState: GameState
): Card[] {
  if (currentTrick.cards.length === 0) return []

  // 勝敗は素の強度比較ではなく実際の勝者判定（狩りJ・よろめき込み）で求める
  return getWinningCardsWithSpecialRules(playableCards, currentTrick, gameState)
}

/**
 * ナポレオン戦略を評価（強化版）
 * Enhanced Napoleon strategy evaluation with cooperation bonus
 */
export function evaluateNapoleonStrategy(
  card: Card,
  gameState: GameState,
  cooperativeInfo: CooperativeStrategyInfo
): number {
  let bonus = 0

  // 基本的なナポレオン戦略: 強いカードを積極的に使う
  const baseStrength = getCardStrengthSafe(card, gameState)
  if (baseStrength > 700) bonus += 100

  // 協力ボーナスを適用
  if (cooperativeInfo.coordinatedPlay?.id === card.id) {
    bonus += cooperativeInfo.cooperationBonus
  }

  // パートナーシグナルに基づく調整
  for (const signal of cooperativeInfo.partnerSignals) {
    // 副官がCAN_WINシグナルを送っている場合、ナポレオンは弱いカードにボーナス
    if (signal.type === 'CAN_WIN' && signal.strength === 'STRONG') {
      if (!isFaceCard(card)) {
        bonus += 50 // 副官に任せる
      }
    }

    // 副官がNEED_HELPシグナルを送っている場合、ナポレオンは強いカードにボーナス
    if (signal.type === 'NEED_HELP' && signal.strength === 'STRONG') {
      if (baseStrength > 700) {
        bonus += 70 // 積極的にサポート
      }
    }
  }

  return bonus
}
