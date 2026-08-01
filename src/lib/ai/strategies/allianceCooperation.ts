/**
 * Alliance team cooperation and coordination logic
 * 連合軍チームの協調戦略とブロッキング戦術
 */

import type { Card, GameState, Player, Suit, Trick } from '@/types/game'
import {
  calculateGameProgress,
  getCardStrengthSafe,
  getLowestWinningCard,
  getWeakestCard,
  isFaceCard,
} from './helpers'
import { extractPartnerSignals } from './signalDecoder'
import {
  getCurrentTrickWinner,
  getWinningCards,
  isTrickSafeAfterPlaying,
  wouldWinTrick,
} from './trickOutcome'
import type {
  CardCountingInfo,
  CooperativeStrategyInfo,
  Signal,
  SignalHistory,
} from './types'

/**
 * 連合軍の協調戦略を評価
 * パートナーからのシグナルとゲーム状況を総合的に判断
 */
export function evaluateAllianceCooperation(
  playableCards: Card[],
  currentTrick: Trick,
  gameState: GameState,
  player: Player,
  signalHistory: SignalHistory,
  cardCounting: CardCountingInfo
): CooperativeStrategyInfo {
  // デフォルトの協調戦略情報
  const defaultInfo: CooperativeStrategyInfo = {
    shouldSignal: false,
    partnerSignals: [],
    reasoning: 'No cooperation needed',
    cooperationBonus: 0,
  }

  // パートナーを特定（連合軍：ナポレオンと副官以外）
  const partners = gameState.players.filter(
    (p) => p.id !== player.id && !p.isNapoleon && !p.isAdjutant
  )

  if (partners.length === 0) {
    return defaultInfo
  }

  // パートナーからのシグナルを取得
  const partnerSignals = extractPartnerSignals(player, gameState, cardCounting)

  // 勝利要件を計算
  const requirements = calculateWinningRequirements(gameState)

  // 1. ブロッキング戦略の判断
  if (
    shouldBlockNapoleon(currentTrick, gameState, requirements, partnerSignals)
  ) {
    const blockingCard = coordinateBlockingStrategy(
      playableCards,
      currentTrick,
      gameState,
      player,
      partnerSignals
    )

    if (blockingCard) {
      return {
        shouldSignal: true,
        partnerSignals,
        coordinatedPlay: blockingCard,
        reasoning: 'Coordinated blocking: Napoleon must be stopped',
        cooperationBonus: 150,
      }
    }
  }

  // 2. 味方に勝たせる戦略の判断
  if (shouldLetPartnerWin(currentTrick, gameState, player, partnerSignals)) {
    const weakestCard = getWeakestCard(playableCards, gameState)
    const candidate = getFaceCardToPassToAlliance(playableCards, gameState)

    // 絵札を渡してよいのは、その絵札を出してもトリックが味方のものとして
    // 確定する場合だけ。位置を見ずに渡すと後続のナポレオンチームに抜かれ、
    // 渡した絵札ごと相手の得点になる。
    const faceCardToPass =
      candidate &&
      isTrickSafeAfterPlaying(
        candidate,
        currentTrick,
        gameState,
        player.hand,
        (playerId) => {
          const owner = gameState.players.find((p) => p.id === playerId)
          return owner ? !owner.isNapoleon && !owner.isAdjutant : false
        }
      )
        ? candidate
        : null

    return {
      shouldSignal: true,
      partnerSignals,
      coordinatedPlay: faceCardToPass || weakestCard,
      reasoning:
        'Letting partner win: Pass face cards to secure points for alliance',
      cooperationBonus: 100,
    }
  }

  // 3. 絵札配分の最適化
  const faceCardDistribution = analyzeFaceCardDistribution(
    gameState,
    requirements
  )

  if (faceCardDistribution.shouldDistribute) {
    return {
      shouldSignal: true,
      partnerSignals,
      reasoning: 'Optimizing face card distribution among alliance members',
      cooperationBonus: 80,
    }
  }

  // 4. シグナル送信の判断
  const shouldSendSignal = determineSendSignal(
    playableCards,
    currentTrick,
    gameState,
    player,
    signalHistory
  )

  if (shouldSendSignal) {
    const signalCard = selectSignalCard(
      playableCards,
      gameState,
      player,
      partnerSignals
    )

    if (signalCard) {
      return {
        shouldSignal: true,
        partnerSignals,
        coordinatedPlay: signalCard,
        reasoning: 'Sending coordination signal to alliance partners',
        cooperationBonus: 60,
      }
    }
  }

  // 5. デフォルト協調ボーナス
  return {
    shouldSignal: false,
    partnerSignals,
    reasoning: 'Standard alliance play: monitoring situation',
    cooperationBonus: 20,
  }
}

/**
 * ナポレオンをブロックすべきかどうかを判断
 */
export function shouldBlockNapoleon(
  currentTrick: Trick,
  gameState: GameState,
  requirements: WinningRequirements,
  partnerSignals: Signal[]
): boolean {
  // 1. ナポレオンチームが現在トリックで勝っているか
  const napoleonOrAdjutantWinning = isNapoleonTeamWinning(
    currentTrick,
    gameState
  )

  if (!napoleonOrAdjutantWinning) {
    return false // ナポレオンが勝っていない場合、ブロック不要
  }

  // 2. 重要局面か（残り2-3トリックで勝敗が決まる）
  if (requirements.isCriticalPhase) {
    return true // 重要局面では常にブロック
  }

  // 3. ナポレオンが目標に近づいている（残り2枚以内）
  if (requirements.napoleonNeedsToWin <= 2) {
    return true // 目標まであと少しなので必ずブロック
  }

  // 4. トリック内の絵札の数を確認
  const faceCardsInTrick = currentTrick.cards.filter((tc) =>
    isFaceCard(tc.card)
  ).length

  if (faceCardsInTrick >= 3) {
    return true // 絵札が多いトリックは価値が高いのでブロック
  }

  // 5. パートナーからのBLOCK_NAPOLEONシグナルを受信
  const blockSignals = partnerSignals.filter(
    (s) => s.type === 'BLOCK_NAPOLEON' && s.strength === 'STRONG'
  )

  if (blockSignals.length > 0) {
    return true // パートナーがブロックを要求
  }

  // 6. 中盤以降（40%以降）で絵札が1枚以上ある場合
  const gameProgress = calculateGameProgress(gameState)
  if (gameProgress >= 0.4 && faceCardsInTrick >= 1) {
    return true // 中盤以降は絵札を守る
  }

  // 7. 基本的なブロッキング：絵札が1枚以上あればブロック（序盤でも）
  if (faceCardsInTrick >= 1) {
    return true // 絵札を取られないようにブロック
  }

  return false
}

/**
 * 味方に勝たせるべきかどうかを判断
 */
export function shouldLetPartnerWin(
  currentTrick: Trick,
  gameState: GameState,
  _player: Player,
  partnerSignals: Signal[]
): boolean {
  // 1. 味方（連合軍）が現在勝っているか
  if (!isAllianceWinning(currentTrick, gameState)) {
    return false // 味方が勝っていない場合、渡す必要なし
  }

  // 2. 自分が最後のプレイヤーか（3枚出た後、4枚目）
  const trickPosition = currentTrick.cards.length
  if (trickPosition === 3) {
    // 最後のプレイヤー：味方が確実に勝つので絵札を渡すチャンス
    return true
  }

  // 3. パートナーからのCAN_WINシグナルを受信
  const canWinSignals = partnerSignals.filter(
    (s) => s.type === 'CAN_WIN' && s.strength === 'STRONG'
  )

  if (canWinSignals.length > 0 && trickPosition >= 1) {
    // パートナーが勝てることを示している場合
    return true
  }

  // 4. 中盤以降（40%以降）で絵札を配分する戦略
  const gameProgress = calculateGameProgress(gameState)
  if (gameProgress >= 0.4 && trickPosition >= 1) {
    // 中盤以降は味方に絵札を渡す戦略を優先
    const faceCardsInTrick = currentTrick.cards.filter((tc) =>
      isFaceCard(tc.card)
    ).length

    if (faceCardsInTrick >= 1) {
      return true // 絵札があれば渡す
    }
  }

  return false
}

/**
 * 協調的なブロッキング戦略のカードを選択
 */
export function coordinateBlockingStrategy(
  playableCards: Card[],
  currentTrick: Trick,
  gameState: GameState,
  _player: Player,
  partnerSignals: Signal[]
): Card | null {
  // 1. 現在のトリックで勝てるカードがあるか確認
  const canWin = canWinCurrentTrick(playableCards, currentTrick, gameState)

  if (!canWin) {
    return null // 勝てない場合、ブロッキング不可
  }

  // 2. パートナーのシグナルを考慮
  const strongTrumpSignals = partnerSignals.filter(
    (s) => s.type === 'TRUMP_STRENGTH' && s.strength === 'STRONG'
  )

  const needHelpSignals = partnerSignals.filter(
    (s) => s.type === 'NEED_HELP' && s.strength === 'STRONG'
  )

  // 3. パートナーが強い切り札を持っている場合、切り札を温存
  if (strongTrumpSignals.length > 0) {
    // 切り札以外で勝てるカードを優先
    const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'
    const nonTrumpWinners = playableCards.filter(
      (card) =>
        card.suit !== trumpSuit && wouldWinTrick(card, currentTrick, gameState)
    )

    if (nonTrumpWinners.length > 0) {
      // 最も弱い勝てる非切り札カードを使う
      return getLowestWinningCard(nonTrumpWinners, currentTrick, gameState)
    }
  }

  // 4. パートナーが助けを求めている場合、確実にブロック
  if (needHelpSignals.length > 0) {
    // 最も弱い勝てるカードを使う（強いカードを温存）
    return getLowestWinningCard(playableCards, currentTrick, gameState)
  }

  // 5. 通常のブロッキング：最も弱い勝てるカードを使う
  return getLowestWinningCard(playableCards, currentTrick, gameState)
}

/**
 * 連合軍の戦略評価（既存のevaluateAllianceStrategyの置き換え）
 */
export function evaluateAllianceStrategy(
  card: Card,
  gameState: GameState,
  cooperativeInfo: CooperativeStrategyInfo
): number {
  let bonus = 0

  // 基本強度を取得
  const baseStrength = getCardStrengthSafe(card, gameState)

  // 1. 従来のボーナス（弱いカードで探り、強いカードは温存）
  if (baseStrength < 300) bonus += 30 // 弱いカードで探り
  if (baseStrength > 800) bonus += 80 // 強いカードは温存

  // 2. 協調戦略ボーナス
  bonus += cooperativeInfo.cooperationBonus

  // 3. 協調的なプレイが推奨されている場合のボーナス
  if (cooperativeInfo.coordinatedPlay) {
    if (card.id === cooperativeInfo.coordinatedPlay.id) {
      bonus += 200 // 協調的なプレイを強く推奨
    }
  }

  // 4. パートナーシグナルに基づくボーナス
  for (const signal of cooperativeInfo.partnerSignals) {
    // BLOCK_NAPOLEONシグナル：強いカードにボーナス
    if (signal.type === 'BLOCK_NAPOLEON' && signal.strength === 'STRONG') {
      if (baseStrength > 700) {
        bonus += 100
      } else if (baseStrength > 500) {
        bonus += 50
      }
    }

    // NEED_HELPシグナル：助けが必要な場合、勝てるカードにボーナス
    if (signal.type === 'NEED_HELP' && signal.strength === 'STRONG') {
      if (baseStrength > 600) {
        bonus += 60
      } else if (baseStrength > 400) {
        bonus += 30
      }
    }

    // TRUMP_STRENGTHシグナル：パートナーが強い切り札を持っている
    if (signal.type === 'TRUMP_STRENGTH' && signal.strength === 'STRONG') {
      const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'
      // 切り札以外を優先（パートナーの切り札を温存）
      if (card.suit !== trumpSuit) {
        bonus += 40
      }
    }
  }

  return bonus
}

/**
 * 絵札配分の最適化を分析
 */
function analyzeFaceCardDistribution(
  gameState: GameState,
  requirements: WinningRequirements
): {
  shouldDistribute: boolean
  targetPlayer?: Player
  reasoning: string
} {
  // 中盤以降（40%以降）で絵札配分を最適化
  const gameProgress = calculateGameProgress(gameState)

  if (gameProgress < 0.4) {
    return {
      shouldDistribute: false,
      reasoning: 'Early game: not yet time to distribute face cards',
    }
  }

  // 連合軍が優勢の場合、絵札配分を最適化
  if (requirements.isAllianceAhead) {
    return {
      shouldDistribute: true,
      reasoning: 'Alliance ahead: distribute face cards to secure victory',
    }
  }

  // ナポレオンが優勢で危機的状況の場合、絵札をブロックに集中
  if (requirements.isNapoleonAhead && requirements.napoleonNeedsToWin <= 3) {
    return {
      shouldDistribute: true,
      reasoning: 'Critical phase: concentrate face cards for blocking Napoleon',
    }
  }

  return {
    shouldDistribute: false,
    reasoning: 'Standard play: no special distribution needed',
  }
}

/**
 * シグナル送信の判断
 */
function determineSendSignal(
  playableCards: Card[],
  currentTrick: Trick,
  gameState: GameState,
  _player: Player,
  signalHistory: SignalHistory
): boolean {
  const trickNumber = gameState.tricks.length
  const gameProgress = calculateGameProgress(gameState)

  // 序盤（最初の2トリック）はシグナルを送らない
  if (trickNumber < 2) return false

  // リードする時はシグナルの必要性が低い
  if (currentTrick.cards.length === 0) return false

  // 終盤（残り2トリック以下）は状況が明確なのでシグナル不要
  const remainingTricks = 12 - trickNumber
  if (remainingTricks <= 2) return false

  // 最近シグナルを送った場合は控える
  const recentSignals = signalHistory.sentSignals.filter(
    (s) => s.trickNumber >= trickNumber - 2
  )
  if (recentSignals.length >= 2) return false

  // 中盤（30-70%）はシグナルが最も効果的
  if (gameProgress >= 0.3 && gameProgress <= 0.7) {
    return playableCards.length >= 2
  }

  return playableCards.length >= 3
}

/**
 * シグナル送信用のカードを選択
 */
function selectSignalCard(
  playableCards: Card[],
  gameState: GameState,
  _player: Player,
  partnerSignals: Signal[]
): Card | null {
  if (playableCards.length === 0) return null
  if (playableCards.length === 1) return playableCards[0]

  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'

  // 1. パートナーがNEED_HELPシグナルを送っている場合、強いカードを示す
  const needHelpSignals = partnerSignals.filter((s) => s.type === 'NEED_HELP')

  if (needHelpSignals.length > 0) {
    // 自分の最強カードを選ぶ（CAN_WINシグナルを送る）
    return playableCards.sort(
      (a, b) =>
        getCardStrengthSafe(b, gameState) - getCardStrengthSafe(a, gameState)
    )[0]
  }

  // 2. 自分が弱い場合、NEED_HELPシグナルを送る
  const avgStrength =
    playableCards.reduce(
      (sum, c) => sum + getCardStrengthSafe(c, gameState),
      0
    ) / playableCards.length

  if (avgStrength < 400) {
    // 最弱カードを選ぶ（NEED_HELPシグナル）
    return playableCards.sort(
      (a, b) =>
        getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
    )[0]
  }

  // 3. 切り札の強さを示す
  const trumpCards = playableCards.filter((c) => c.suit === trumpSuit)
  if (trumpCards.length >= 2) {
    const strongTrumps = trumpCards.filter(
      (c) => getCardStrengthSafe(c, gameState) >= 710
    )

    if (strongTrumps.length > 0) {
      // 強い切り札を選ぶ（TRUMP_STRENGTHシグナル）
      return strongTrumps.sort(
        (a, b) =>
          getCardStrengthSafe(b, gameState) - getCardStrengthSafe(a, gameState)
      )[0]
    }
  }

  // 4. デフォルト：中程度のカードを選ぶ
  const sorted = playableCards.sort(
    (a, b) =>
      getCardStrengthSafe(b, gameState) - getCardStrengthSafe(a, gameState)
  )
  return sorted[Math.floor(sorted.length / 2)]
}

/**
 * ナポレオンチームが現在勝っているか
 */
function isNapoleonTeamWinning(
  currentTrick: Trick,
  gameState: GameState
): boolean {
  if (currentTrick.cards.length === 0) return false

  // 勝者は素の強度ではなく実際の勝者判定（狩りJ・よろめき込み）で求める
  const winner = getCurrentTrickWinner(currentTrick, gameState)
  if (!winner) return false

  const napoleon = gameState.players.find((p) => p.isNapoleon)
  const adjutant = gameState.players.find((p) => p.isAdjutant)

  if (!napoleon) return false

  return (
    winner.playerId === napoleon.id ||
    (adjutant !== undefined && winner.playerId === adjutant.id)
  )
}

/**
 * 連合軍が現在勝っているか
 */
function isAllianceWinning(currentTrick: Trick, gameState: GameState): boolean {
  if (currentTrick.cards.length === 0) return false

  const winner = getCurrentTrickWinner(currentTrick, gameState)
  if (!winner) return false

  const player = gameState.players.find((p) => p.id === winner.playerId)

  if (!player) return false

  return !player.isNapoleon && !player.isAdjutant
}

/**
 * 現在のトリックで勝てるか（特殊ルール込み）
 */
function canWinCurrentTrick(
  cards: Card[],
  currentTrick: Trick,
  gameState: GameState
): boolean {
  if (currentTrick.cards.length === 0) return true

  return getWinningCards(cards, currentTrick, gameState).length > 0
}

/**
 * 連合軍が味方に絵札を渡す
 */
function getFaceCardToPassToAlliance(
  cards: Card[],
  gameState: GameState
): Card | null {
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'

  // マイティーと特殊カードを除外した絵札を取得
  const faceCardsExcludingSpecial = cards.filter((card) => {
    if (!isFaceCard(card)) return false

    // マイティーチェック（スペードのA）
    if (card.suit === 'spades' && card.rank === 'A') return false

    // 切り札のJack（表ジャック）
    if (card.suit === trumpSuit && card.rank === 'J') return false

    // 裏ジャック（切り札と同色の別スートのJack）
    const counterSuit = getCounterSuit(trumpSuit)
    if (card.suit === counterSuit && card.rank === 'J') return false

    return true
  })

  if (faceCardsExcludingSpecial.length > 0) {
    // 最も強い絵札を返す
    return faceCardsExcludingSpecial.sort(
      (a, b) =>
        getCardStrengthSafe(b, gameState) - getCardStrengthSafe(a, gameState)
    )[0]
  }

  return null
}

/**
 * 裏ジャックのスートを取得
 */
function getCounterSuit(trumpSuit: Suit): Suit {
  // 切り札と同色の別スート
  if (trumpSuit === 'spades') return 'clubs'
  if (trumpSuit === 'clubs') return 'spades'
  if (trumpSuit === 'hearts') return 'diamonds'
  if (trumpSuit === 'diamonds') return 'hearts'
  return 'spades'
}

/**
 * 勝利要件を計算
 */
interface WinningRequirements {
  napoleonTeamFaceCards: number
  allianceTeamFaceCards: number
  remainingFaceCards: number
  remainingTricks: number
  napoleonNeedsToWin: number
  allianceNeedsToBlock: number
  napoleonCanAffordToLose: number
  isNapoleonAhead: boolean
  isAllianceAhead: boolean
  isCriticalPhase: boolean
}

function calculateWinningRequirements(
  gameState: GameState
): WinningRequirements {
  const totalFaceCards = 13
  const napoleonTarget = gameState.napoleonDeclaration?.targetTricks || 8

  let napoleonTeamFaceCards = 0
  let allianceTeamFaceCards = 0

  const napoleon = gameState.players.find((p) => p.isNapoleon)
  const adjutant = gameState.players.find((p) => p.isAdjutant)

  for (const trick of gameState.tricks) {
    const winner = trick.winnerPlayerId
    if (!winner) continue

    const faceCardsInTrick = trick.cards.filter((tc) =>
      isFaceCard(tc.card)
    ).length

    if (winner === napoleon?.id || (adjutant && winner === adjutant.id)) {
      napoleonTeamFaceCards += faceCardsInTrick
    } else {
      allianceTeamFaceCards += faceCardsInTrick
    }
  }

  const remainingFaceCards =
    totalFaceCards - napoleonTeamFaceCards - allianceTeamFaceCards
  const totalTricks = 12
  const completedTricks = gameState.tricks.length
  const remainingTricks = totalTricks - completedTricks

  const napoleonNeedsToWin = Math.max(0, napoleonTarget - napoleonTeamFaceCards)
  const allianceNeedsToBlock = Math.max(
    0,
    totalFaceCards - napoleonTarget + 1 - allianceTeamFaceCards
  )
  const napoleonCanAffordToLose = Math.max(
    0,
    remainingFaceCards - napoleonNeedsToWin
  )

  const isNapoleonAhead = napoleonNeedsToWin <= remainingTricks / 2
  const isAllianceAhead = allianceNeedsToBlock <= remainingTricks / 2

  const isCriticalPhase =
    remainingTricks <= 3 && (napoleonNeedsToWin > 0 || allianceNeedsToBlock > 0)

  return {
    napoleonTeamFaceCards,
    allianceTeamFaceCards,
    remainingFaceCards,
    remainingTricks,
    napoleonNeedsToWin,
    allianceNeedsToBlock,
    napoleonCanAffordToLose,
    isNapoleonAhead,
    isAllianceAhead,
    isCriticalPhase,
  }
}
