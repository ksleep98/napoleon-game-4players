/**
 * Signal decoding and pattern recognition functions
 * パートナーのカード選択からシグナルを解読
 */

import type { Card, GameState, Player, Suit, Trick } from '@/types/game'
import { getCardStrengthSafe } from './helpers'
import type {
  CardCountingInfo,
  CardPlayPattern,
  Signal,
  SignalHistory,
} from './types'

/**
 * パートナーのカード選択からシグナルを解読
 * プレイ可能なカードの推定とプレイしたカードから意図を読み取る
 */
export function decodePartnerPlay(
  partnerCard: Card,
  partnerPlayableCards: Card[], // 推定されるプレイ可能カード
  currentTrick: Trick,
  gameState: GameState,
  _cardCounting: CardCountingInfo
): Signal[] {
  const signals: Signal[] = []
  const trickNumber = gameState.tricks.length
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'

  // プレイ可能カードが1枚しかない場合、シグナルの意図はない
  if (partnerPlayableCards.length <= 1) return signals

  // カードの強さを評価
  const cardStrength = getCardStrengthSafe(partnerCard, gameState)
  const avgStrength =
    partnerPlayableCards.reduce(
      (sum, c) => sum + getCardStrengthSafe(c, gameState),
      0
    ) / partnerPlayableCards.length
  const maxStrength = Math.max(
    ...partnerPlayableCards.map((c) => getCardStrengthSafe(c, gameState))
  )
  const minStrength = Math.min(
    ...partnerPlayableCards.map((c) => getCardStrengthSafe(c, gameState))
  )

  // 1. スートの強さシグナル
  const suitCards = partnerPlayableCards.filter(
    (c) => c.suit === partnerCard.suit
  )
  if (suitCards.length >= 2) {
    if (cardStrength > avgStrength * 1.3) {
      signals.push({
        type: 'SUIT_STRENGTH',
        strength: 'STRONG',
        suit: partnerCard.suit,
        trickNumber,
        playerId:
          currentTrick.cards.find((tc) => tc.card === partnerCard)?.playerId ||
          '',
        confidence: 0.7,
      })
    } else if (cardStrength < avgStrength * 0.7) {
      signals.push({
        type: 'SUIT_STRENGTH',
        strength: 'WEAK',
        suit: partnerCard.suit,
        trickNumber,
        playerId:
          currentTrick.cards.find((tc) => tc.card === partnerCard)?.playerId ||
          '',
        confidence: 0.6,
      })
    }
  }

  // 2. ボイドシグナル（切り札を出した場合）
  if (
    partnerCard.suit === trumpSuit &&
    currentTrick.leadingSuit &&
    currentTrick.leadingSuit !== trumpSuit
  ) {
    // リードスートに対してボイド
    signals.push({
      type: 'VOID_SUIT',
      strength: 'STRONG',
      suit: currentTrick.leadingSuit,
      trickNumber,
      playerId:
        currentTrick.cards.find((tc) => tc.card === partnerCard)?.playerId ||
        '',
      confidence: 0.9,
    })
  }

  // 3. 勝てる/助けが必要シグナル
  if (cardStrength === maxStrength && maxStrength > avgStrength * 1.2) {
    signals.push({
      type: 'CAN_WIN',
      strength: 'STRONG',
      trickNumber,
      playerId:
        currentTrick.cards.find((tc) => tc.card === partnerCard)?.playerId ||
        '',
      confidence: 0.8,
    })
  } else if (cardStrength === minStrength && minStrength < avgStrength * 0.8) {
    signals.push({
      type: 'NEED_HELP',
      strength: 'STRONG',
      trickNumber,
      playerId:
        currentTrick.cards.find((tc) => tc.card === partnerCard)?.playerId ||
        '',
      confidence: 0.7,
    })
  }

  // 4. 切り札の強さシグナル
  if (partnerCard.suit === trumpSuit) {
    // TRUMP_BASE is 700, so adjust thresholds:
    // > 710 (Ace, King): STRONG
    // 705-710 (Queen, Jack, 10): MODERATE
    // < 705 (lower cards): no signal
    if (cardStrength >= 710) {
      signals.push({
        type: 'TRUMP_STRENGTH',
        strength: 'STRONG',
        trickNumber,
        playerId:
          currentTrick.cards.find((tc) => tc.card === partnerCard)?.playerId ||
          '',
        confidence: 0.8,
      })
    } else if (cardStrength >= 705) {
      signals.push({
        type: 'TRUMP_STRENGTH',
        strength: 'MODERATE',
        trickNumber,
        playerId:
          currentTrick.cards.find((tc) => tc.card === partnerCard)?.playerId ||
          '',
        confidence: 0.7,
      })
    }
  }

  return signals
}

/**
 * プレイヤーのプレイパターンを分析
 * 過去のトリックから、プレイヤーのカード選択パターンを抽出
 */
export function analyzePlayPattern(
  playerId: string,
  gameState: GameState,
  cardCounting: CardCountingInfo
): CardPlayPattern[] {
  const patterns: CardPlayPattern[] = []

  for (const [index, trick] of gameState.tricks.entries()) {
    const playerCard = trick.cards.find((tc) => tc.playerId === playerId)
    if (!playerCard) continue

    const wasLeading = trick.cards[0].playerId === playerId
    const cardStrength = getCardStrengthSafe(playerCard.card, gameState)

    // プレイ可能だったカード数を推定（同じスートのカード数）
    const suitTracking = cardCounting.suitTracking.get(playerCard.card.suit)
    const playableCards = suitTracking?.remainingCards || 1

    // プレイの文脈を判断
    let context: CardPlayPattern['context'] = 'NORMAL'

    if (wasLeading) {
      // リードプレイの場合、強いカードならAGGRESSIVE
      if (cardStrength > 600) {
        context = 'AGGRESSIVE'
      } else if (cardStrength < 300) {
        context = 'CONSERVATIVE'
      }
    } else {
      // フォローの場合、選択肢があるかチェック
      if (playableCards >= 2) {
        // トリック内の他のカードと比較
        const trickStrengths = trick.cards.map((tc) =>
          getCardStrengthSafe(tc.card, gameState)
        )
        const maxTrickStrength = Math.max(...trickStrengths)

        if (cardStrength === maxTrickStrength) {
          context = 'AGGRESSIVE' // 勝つことを選択
        } else if (cardStrength < maxTrickStrength * 0.5) {
          context = 'CONSERVATIVE' // 弱いカードを温存のため出した
        } else {
          context = 'SIGNALING' // 中程度のカード = シグナリングの可能性
        }
      }
    }

    patterns.push({
      playerId,
      trickNumber: index,
      wasLeading,
      cardPlayed: playerCard.card,
      playableCards,
      context,
    })
  }

  return patterns
}

/**
 * パートナーからのシグナルを抽出
 * ゲーム全体からパートナーのプレイを分析してシグナルを抽出
 */
export function extractPartnerSignals(
  player: Player,
  gameState: GameState,
  cardCounting: CardCountingInfo
): Signal[] {
  const allSignals: Signal[] = []

  // パートナーを特定
  const partners = identifyPartners(player, gameState)
  if (partners.length === 0) return allSignals

  // 各完了トリックを分析
  for (const trick of gameState.tricks) {
    if (!trick.winnerPlayerId) continue // 未完了トリックはスキップ

    for (const partner of partners) {
      const partnerCard = trick.cards.find((tc) => tc.playerId === partner.id)
      if (!partnerCard) continue

      // パートナーのプレイ可能カードを推定
      const playableCards = estimatePlayableCards(
        partner,
        trick,
        gameState,
        cardCounting
      )

      // シグナルを解読
      const signals = decodePartnerPlay(
        partnerCard.card,
        playableCards,
        trick,
        gameState,
        cardCounting
      )

      allSignals.push(...signals)
    }
  }

  return allSignals
}

/**
 * シグナル履歴を構築
 * 自分が送ったシグナルとパートナーから受け取ったシグナルを整理
 */
export function buildSignalHistory(
  player: Player,
  gameState: GameState,
  cardCounting: CardCountingInfo
): SignalHistory {
  // パートナーからのシグナルを抽出
  const receivedSignals = extractPartnerSignals(player, gameState, cardCounting)

  // パートナーのプレイパターンを分析
  const partners = identifyPartners(player, gameState)
  const partnerPlayPatterns: CardPlayPattern[] = []

  for (const partner of partners) {
    const patterns = analyzePlayPattern(partner.id, gameState, cardCounting)
    partnerPlayPatterns.push(...patterns)
  }

  return {
    sentSignals: [], // 送信したシグナルは別途管理（encoderで記録）
    receivedSignals,
    partnerPlayPatterns,
  }
}

/**
 * パートナーを特定
 * ナポレオンチーム vs 連合軍でパートナーを判別
 */
function identifyPartners(player: Player, gameState: GameState): Player[] {
  const partners: Player[] = []

  if (player.isNapoleon) {
    // ナポレオンのパートナーは副官
    const adjutant = gameState.players.find((p) => p.isAdjutant)
    if (adjutant) partners.push(adjutant)
  } else if (player.isAdjutant) {
    // 副官のパートナーはナポレオン
    const napoleon = gameState.players.find((p) => p.isNapoleon)
    if (napoleon) partners.push(napoleon)
  } else {
    // 連合軍：ナポレオンと副官以外のプレイヤー全員
    for (const p of gameState.players) {
      if (p.id !== player.id && !p.isNapoleon && !p.isAdjutant) {
        partners.push(p)
      }
    }
  }

  return partners
}

/**
 * プレイ可能だったカードを推定
 * カードカウンティング情報から、そのトリックでプレイ可能だったカードを推定
 */
function estimatePlayableCards(
  _player: Player,
  trick: Trick,
  gameState: GameState,
  cardCounting: CardCountingInfo
): Card[] {
  const playableCards: Card[] = []
  const leadingSuit = trick.leadingSuit

  // 現在の手札からプレイ可能カードを推定
  // （実際にはゲーム進行中なので、過去のトリックから逆算する必要がある）

  // 簡易実装：リードスートがあればそのスートのカード、なければ全カード
  if (leadingSuit) {
    const suitTracking = cardCounting.suitTracking.get(leadingSuit)
    if (suitTracking && suitTracking.remainingCards > 0) {
      // リードスートのカードがあると推定
      // 実際のカードは推定できないので、代表的なカードを生成
      // より正確な実装には、プレイヤーの手札履歴を追跡する必要がある
      playableCards.push({
        id: `estimated-${leadingSuit}-1`,
        suit: leadingSuit,
        rank: 'A',
        value: 14,
      })
      playableCards.push({
        id: `estimated-${leadingSuit}-2`,
        suit: leadingSuit,
        rank: '7',
        value: 7,
      })
    } else {
      // ボイド：切り札を含む全スート
      const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'
      const trumpTracking = cardCounting.suitTracking.get(trumpSuit)
      if (trumpTracking && trumpTracking.remainingCards > 0) {
        playableCards.push({
          id: `estimated-${trumpSuit}-trump`,
          suit: trumpSuit,
          rank: 'A',
          value: 14,
        })
      }
    }
  } else {
    // リード時：全カードプレイ可能
    // 簡易実装として代表的なカードを追加
    playableCards.push(
      {
        id: 'estimated-lead-1',
        suit: 'hearts',
        rank: 'A',
        value: 14,
      },
      {
        id: 'estimated-lead-2',
        suit: 'spades',
        rank: 'K',
        value: 13,
      }
    )
  }

  return playableCards
}
