import type {
  Card,
  GameState,
  NapoleonDeclaration,
  Rank,
  Suit,
} from '@/types/game'
import { getMinimumDeclaration } from '../napoleonRules'

// AI がナポレオンを宣言するかどうかの判定（改善版）
export function shouldDeclareNapoleon(
  hand: Card[],
  currentDeclaration?: NapoleonDeclaration
): { shouldDeclare: boolean; declaration?: NapoleonDeclaration } {
  // 手札の強さを評価
  const handStrength = evaluateHandStrength(hand)

  // 現在の宣言状況を確認
  const { minTricks, availableSuits } =
    getMinimumDeclaration(currentDeclaration)

  // 宣言可能な最小トリック数で勝てるかを判定
  for (let tricks = minTricks; tricks <= 20; tricks++) {
    for (const suit of availableSuits) {
      if (canWinWithDeclaration(hand, tricks, suit, handStrength)) {
        return {
          shouldDeclare: true,
          declaration: {
            playerId: '', // 呼び出し元で設定
            targetTricks: tricks,
            suit: suit as Suit,
          },
        }
      }
    }
  }

  return { shouldDeclare: false }
}

// 手札の強さを数値で評価
function evaluateHandStrength(hand: Card[]): number {
  let strength = 0

  // 各カードの基本点数
  for (const card of hand) {
    strength += card.value
  }

  // エースボーナス
  const aces = hand.filter((card) => card.rank === 'A').length
  strength += aces * 5

  // キング・クイーンボーナス
  const kings = hand.filter((card) => card.rank === 'K').length
  const queens = hand.filter((card) => card.rank === 'Q').length
  strength += (kings + queens) * 2

  // 同じスートの枚数ボーナス（長いスートは有利）
  const suitCounts: Record<string, number> = {}
  for (const card of hand) {
    suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1
  }

  for (const count of Object.values(suitCounts)) {
    if (count >= 4) {
      strength += (count - 3) * 3 // 長いスートにボーナス
    }
  }

  return strength
}

// 指定したトリック数とスートで勝てるかを判定
function canWinWithDeclaration(
  hand: Card[],
  targetTricks: number,
  suit: Suit,
  handStrength: number
): boolean {
  // 基本的な勝利判定
  const baseWinProbability = Math.min(handStrength / 180, 0.9) // 最大90%

  // トリック数による難易度調整
  const difficultyMultiplier = Math.max(0.3, 1 - (targetTricks - 13) * 0.1)

  // 該当スートのカード数
  const suitCards = hand.filter((card) => card.suit === suit).length
  const suitBonus = suitCards >= 3 ? 0.1 : 0

  const winProbability = baseWinProbability * difficultyMultiplier + suitBonus

  // 70%以上の勝率なら宣言
  return winProbability >= 0.7
}

// AI がナポレオンになった場合の副官カード選択
export function selectAdjutantCard(hand: Card[]): Card | null {
  // 自分の手札にない強いカードを副官として選ぶ
  const _handsuits = new Set(hand.map((card) => card.suit))
  const _handRanks = new Set(hand.map((card) => card.rank))

  // エース優先
  const preferredRanks: Array<{ rank: string; value: number }> = [
    { rank: 'A', value: 14 },
    { rank: 'K', value: 13 },
    { rank: 'Q', value: 12 },
    { rank: 'J', value: 11 },
  ]

  const suits = ['spades', 'hearts', 'diamonds', 'clubs']

  // 自分が持っていない強いカードを探す
  for (const preferredRank of preferredRanks) {
    for (const suit of suits) {
      const cardId = `${suit}-${preferredRank.rank}`
      if (!hand.some((card) => card.id === cardId)) {
        return {
          id: cardId,
          suit: suit as Suit,
          rank: preferredRank.rank as Rank,
          value: preferredRank.value,
        }
      }
    }
  }

  return null
}

// ナポレオン AI の戦略的思考（改善版）
export function napoleonAIStrategy(
  gameState: GameState,
  playerId: string
): {
  shouldDeclare: boolean
  declaration?: NapoleonDeclaration
  adjutantCard?: Card
} {
  const player = gameState.players.find((p) => p.id === playerId)
  if (!player) {
    return { shouldDeclare: false }
  }

  const result = shouldDeclareNapoleon(
    player.hand,
    gameState.napoleonDeclaration
  )

  if (result.shouldDeclare && result.declaration) {
    // プレイヤーIDを設定
    const declaration = {
      ...result.declaration,
      playerId,
    }

    // 副官カードを選択
    const adjutantCard = selectAdjutantCard(player.hand)
    if (adjutantCard) {
      declaration.adjutantCard = adjutantCard
    }

    return {
      shouldDeclare: true,
      declaration,
      adjutantCard: adjutantCard || undefined,
    }
  }

  return { shouldDeclare: false }
}
