/**
 * Card counting and tracking functions for AI strategy
 * カードカウンティングとトラッキング機能
 */

import {
  isCounterJack as checkIsCounterJack,
  isMighty as checkIsMighty,
  isTrumpJack as checkIsTrumpJack,
} from '@/lib/napoleonCardRules'
import type { Card, GameState, Player, Suit } from '@/types/game'
import { getCardStrengthSafe, isFaceCard } from './helpers'
import type { CardCountingInfo, SuitTracking, TrumpTracking } from './types'

/**
 * 切り札の追跡情報を取得
 * 既に出た切り札、残り切り札、自分の切り札の状況を分析
 */
export function trackTrumps(
  player: Player,
  gameState: GameState
): TrumpTracking {
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'
  const totalTrumpsInDeck = 13 // 各スート13枚

  // 既に出た切り札を収集
  const playedTrumps: Card[] = []

  // 完了したトリックから切り札を収集
  for (const trick of gameState.tricks) {
    for (const playedCard of trick.cards) {
      if (playedCard.card.suit === trumpSuit) {
        playedTrumps.push(playedCard.card)
      }
    }
  }

  // 現在のトリックからも切り札を収集
  for (const playedCard of gameState.currentTrick.cards) {
    if (playedCard.card.suit === trumpSuit) {
      playedTrumps.push(playedCard.card)
    }
  }

  // Mightyが出ている場合も切り札としてカウント（スペードAの場合）
  for (const trick of gameState.tricks) {
    for (const playedCard of trick.cards) {
      if (checkIsMighty(playedCard.card)) {
        // Mightyは常に最強なのでカウント
        playedTrumps.push(playedCard.card)
      }
    }
  }
  for (const playedCard of gameState.currentTrick.cards) {
    if (checkIsMighty(playedCard.card)) {
      playedTrumps.push(playedCard.card)
    }
  }

  // 自分の切り札を取得
  const myTrumps = player.hand.filter(
    (card) =>
      card.suit === trumpSuit ||
      checkIsMighty(card) ||
      checkIsTrumpJack(card, trumpSuit) ||
      checkIsCounterJack(card, trumpSuit)
  )

  // 自分の最強切り札を特定
  let myStrongestTrump: Card | null = null
  if (myTrumps.length > 0) {
    myStrongestTrump = myTrumps.sort(
      (a, b) =>
        getCardStrengthSafe(b, gameState) - getCardStrengthSafe(a, gameState)
    )[0]
  }

  // 高位切り札を持っているか
  const hasHighTrumps = myTrumps.some(
    (card) =>
      checkIsMighty(card) ||
      checkIsTrumpJack(card, trumpSuit) ||
      checkIsCounterJack(card, trumpSuit) ||
      ['A', 'K', 'Q'].includes(card.rank)
  )

  // 残り切り札枚数を推定
  const remainingTrumps =
    totalTrumpsInDeck - playedTrumps.length - myTrumps.length

  // 自分より強い切り札の推定枚数
  let trumpsStrongerThanMine = 0
  if (myStrongestTrump) {
    const myStrongestStrength = getCardStrengthSafe(myStrongestTrump, gameState)

    // Mighty, Jack, 高位カードのうち、まだ出ていないものをカウント
    const highTrumps = [
      { rank: 'A', strength: 1400 }, // Mighty (if not Mighty suit)
      { rank: 'K', strength: 1300 },
      { rank: 'Q', strength: 1200 },
      { rank: 'J', strength: 1100 }, // Trump Jack or Counter Jack
    ]

    for (const highTrump of highTrumps) {
      if (highTrump.strength > myStrongestStrength) {
        // このカードが既に出ているかチェック
        const alreadyPlayed = playedTrumps.some(
          (card) => card.rank === highTrump.rank && card.suit === trumpSuit
        )
        // 自分が持っているかチェック
        const inMyHand = myTrumps.some((card) => card.rank === highTrump.rank)

        if (!alreadyPlayed && !inMyHand) {
          trumpsStrongerThanMine++
        }
      }
    }
  }

  return {
    playedTrumps,
    remainingTrumps,
    myTrumps,
    myStrongestTrump,
    hasHighTrumps,
    trumpsStrongerThanMine,
  }
}

/**
 * 全カードの追跡情報を取得
 * スート別に既に出たカード、残りカード、絵札の状況を分析
 */
export function trackAllCards(
  player: Player,
  gameState: GameState
): CardCountingInfo {
  const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
  const suitTracking = new Map<Suit, SuitTracking>()
  const cardsPerSuit = 13 // 各スート13枚

  let totalPlayedCards = 0
  let totalPlayedFaceCards = 0

  // 各スートごとに追跡
  for (const suit of suits) {
    const playedCards: Card[] = []
    const playedFaceCards: Card[] = []

    // 完了したトリックからカードを収集
    for (const trick of gameState.tricks) {
      for (const playedCard of trick.cards) {
        if (playedCard.card.suit === suit) {
          playedCards.push(playedCard.card)
          if (isFaceCard(playedCard.card)) {
            playedFaceCards.push(playedCard.card)
          }
        }
      }
    }

    // 現在のトリックからカードを収集
    for (const playedCard of gameState.currentTrick.cards) {
      if (playedCard.card.suit === suit) {
        playedCards.push(playedCard.card)
        if (isFaceCard(playedCard.card)) {
          playedFaceCards.push(playedCard.card)
        }
      }
    }

    // 自分の手札からこのスートのカードを収集
    const myCards = player.hand.filter((card) => card.suit === suit)
    const myFaceCards = myCards.filter((card) => isFaceCard(card))

    // 残りカード枚数を推定（総数 - 出たカード - 自分の手札）
    const remainingCards = cardsPerSuit - playedCards.length - myCards.length

    // このスートの絵札総数（4枚：A, K, Q, J）
    const faceCardsPerSuit = 4
    const remainingFaceCards =
      faceCardsPerSuit - playedFaceCards.length - myFaceCards.length

    // 高位カード（A, K, Q, J）を持っているか
    const hasHighCards = myCards.some((card) =>
      ['A', 'K', 'Q', 'J'].includes(card.rank)
    )

    suitTracking.set(suit, {
      suit,
      playedCards,
      remainingCards,
      playedFaceCards,
      remainingFaceCards,
      myCards,
      myFaceCards,
      hasHighCards,
    })

    totalPlayedCards += playedCards.length
    totalPlayedFaceCards += playedFaceCards.length
  }

  // 全体の統計
  const totalCardsInDeck = 52
  const totalFaceCardsInDeck = 16 // 4スート × 4絵札
  const totalRemainingCards =
    totalCardsInDeck - totalPlayedCards - player.hand.length
  const myTotalFaceCards = player.hand.filter((card) => isFaceCard(card)).length
  const totalRemainingFaceCards =
    totalFaceCardsInDeck - totalPlayedFaceCards - myTotalFaceCards

  return {
    suitTracking,
    totalPlayedCards,
    totalRemainingCards,
    totalPlayedFaceCards,
    totalRemainingFaceCards,
  }
}

/**
 * プレイヤーのボイド（特定スートを持っていない状態）を推定
 * 過去のトリックから、プレイヤーがどのスートを持っていないかを推測
 */
export function estimatePlayerVoids(
  gameState: GameState
): Map<string, Set<Suit>> {
  const playerVoids = new Map<string, Set<Suit>>()

  // 各プレイヤーのボイドセットを初期化
  for (const player of gameState.players) {
    playerVoids.set(player.id, new Set<Suit>())
  }

  // 完了したトリックを分析
  for (const trick of gameState.tricks) {
    if (!trick.leadingSuit) continue

    const leadingSuit = trick.leadingSuit

    // トリック内の各カードをチェック
    for (const playedCard of trick.cards) {
      const playerId = playedCard.playerId
      const card = playedCard.card

      // リードスートと異なるスートを出した場合、そのプレイヤーはリードスートをボイドしている
      // ただし、Mightyやジャックは特殊なので除外
      if (
        card.suit !== leadingSuit &&
        !checkIsMighty(card) &&
        !checkIsTrumpJack(card, (gameState.trumpSuit as Suit) || 'spades') &&
        !checkIsCounterJack(card, (gameState.trumpSuit as Suit) || 'spades')
      ) {
        const voidSet = playerVoids.get(playerId)
        if (voidSet) {
          voidSet.add(leadingSuit)
        }
      }
    }
  }

  // 現在のトリックも分析（ただし、まだ完了していないので注意）
  if (gameState.currentTrick.leadingSuit) {
    const leadingSuit = gameState.currentTrick.leadingSuit

    for (const playedCard of gameState.currentTrick.cards) {
      const playerId = playedCard.playerId
      const card = playedCard.card

      if (
        card.suit !== leadingSuit &&
        !checkIsMighty(card) &&
        !checkIsTrumpJack(card, (gameState.trumpSuit as Suit) || 'spades') &&
        !checkIsCounterJack(card, (gameState.trumpSuit as Suit) || 'spades')
      ) {
        const voidSet = playerVoids.get(playerId)
        if (voidSet) {
          voidSet.add(leadingSuit)
        }
      }
    }
  }

  return playerVoids
}
