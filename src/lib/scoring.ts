import { countFaceCards, NAPOLEON_RULES } from '@/lib/constants'
import type { GameResult, GameState, PlayerScore } from '@/types/game'

/**
 * ゲーム結果を計算して判定する
 */
export function calculateGameResult(gameState: GameState): GameResult {
  const napoleonPlayer = gameState.players.find((p) => p.isNapoleon)
  const adjutantPlayer = gameState.players.find((p) => p.isAdjutant)

  if (!napoleonPlayer) {
    throw new Error('Napoleon player not found')
  }

  // ナポレオン・副官側が取った絵札数を計算
  const napoleonFaceCards = gameState.tricks
    .filter(
      (trick) =>
        trick.winnerPlayerId === napoleonPlayer.id ||
        (adjutantPlayer && trick.winnerPlayerId === adjutantPlayer.id)
    )
    .reduce((total, trick) => {
      return total + countFaceCards(trick.cards.map((c) => c.card))
    }, 0)

  // ナポレオン側の勝利判定
  const napoleonWon = napoleonFaceCards >= NAPOLEON_RULES.TARGET_FACE_CARDS

  // プレイヤーごとのスコアを計算
  const scores: PlayerScore[] = gameState.players.map((player) => {
    let points = 0
    let isWinner = false

    if (player.isNapoleon) {
      if (napoleonWon) {
        points =
          NAPOLEON_RULES.NAPOLEON_BONUS +
          napoleonFaceCards * NAPOLEON_RULES.BASE_POINTS
        isWinner = true
      } else {
        points = -(NAPOLEON_RULES.NAPOLEON_BONUS / 2) // ナポレオン失敗時のペナルティ
      }
    } else if (player.isAdjutant) {
      if (napoleonWon) {
        points =
          NAPOLEON_RULES.ADJUTANT_BONUS +
          (napoleonFaceCards * NAPOLEON_RULES.BASE_POINTS) / 2
        isWinner = true
      } else {
        points = -(NAPOLEON_RULES.ADJUTANT_BONUS / 2) // 副官失敗時のペナルティ
      }
    } else {
      // 市民側
      if (!napoleonWon) {
        // ナポレオン阻止成功時のボーナス（市民全員で分割）
        const totalFaceCards = 20 // 全絵札数
        const citizenFaceCards = totalFaceCards - napoleonFaceCards
        points =
          NAPOLEON_RULES.NAPOLEON_BONUS / 2 +
          (citizenFaceCards * NAPOLEON_RULES.BASE_POINTS) / 2
        isWinner = true
      } else {
        points = -NAPOLEON_RULES.BASE_POINTS // ナポレオン阻止失敗時のペナルティ
      }
    }

    return {
      playerId: player.id,
      points: Math.round(points),
      isWinner,
    }
  })

  return {
    gameId: gameState.id,
    napoleonWon,
    napoleonPlayerId: napoleonPlayer.id,
    adjutantPlayerId: adjutantPlayer?.id,
    faceCardsWon: napoleonFaceCards,
    scores,
  }
}

/**
 * プレイヤーが取った絵札数を計算
 */
export function getPlayerFaceCardCount(
  gameState: GameState,
  playerId: string
): number {
  return gameState.tricks
    .filter((trick) => trick.winnerPlayerId === playerId)
    .reduce((total, trick) => {
      return total + countFaceCards(trick.cards.map((c) => c.card))
    }, 0)
}

/**
 * 各チーム（ナポレオン側 vs 市民側）の取った絵札数を計算
 */
export function getTeamFaceCardCounts(gameState: GameState): {
  napoleonTeam: number
  citizenTeam: number
} {
  const napoleonPlayer = gameState.players.find((p) => p.isNapoleon)
  const adjutantPlayer = gameState.players.find((p) => p.isAdjutant)

  const napoleonTeamIds = [napoleonPlayer?.id, adjutantPlayer?.id].filter(
    Boolean
  ) as string[]

  const napoleonTeam = gameState.tricks
    .filter(
      (trick) =>
        trick.winnerPlayerId && napoleonTeamIds.includes(trick.winnerPlayerId)
    )
    .reduce((total, trick) => {
      return total + countFaceCards(trick.cards.map((c) => c.card))
    }, 0)

  const totalFaceCards = 20 // 全絵札数
  const citizenTeam = totalFaceCards - napoleonTeam

  return { napoleonTeam, citizenTeam }
}

/**
 * 現在のゲーム進行状況を取得
 */
export function getGameProgress(gameState: GameState): {
  tricksPlayed: number
  tricksRemaining: number
  napoleonTeamFaceCards: number
  citizenTeamFaceCards: number
  napoleonNeedsToWin: number
} {
  const { napoleonTeam, citizenTeam } = getTeamFaceCardCounts(gameState)
  const tricksPlayed = gameState.tricks.length
  const tricksRemaining = 12 - tricksPlayed
  const napoleonNeedsToWin = Math.max(
    0,
    NAPOLEON_RULES.TARGET_FACE_CARDS - napoleonTeam
  )

  return {
    tricksPlayed,
    tricksRemaining,
    napoleonTeamFaceCards: napoleonTeam,
    citizenTeamFaceCards: citizenTeam,
    napoleonNeedsToWin,
  }
}

/**
 * ゲームの勝敗が確定しているかチェック
 */
export function isGameDecided(gameState: GameState): {
  decided: boolean
  napoleonWon?: boolean
  reason?: string
} {
  const { napoleonTeamFaceCards, tricksRemaining } = getGameProgress(gameState)

  // ナポレオン側が既に必要な絵札数を達成
  if (napoleonTeamFaceCards >= NAPOLEON_RULES.TARGET_FACE_CARDS) {
    return {
      decided: true,
      napoleonWon: true,
      reason: 'Napoleon team reached target face cards',
    }
  }

  // ナポレオン側が残りトリックで取れる最大絵札数を計算
  const maxRemainingFaceCards = tricksRemaining * 5 // 最大でトリックごとに5枚の絵札がある可能性
  if (
    napoleonTeamFaceCards + maxRemainingFaceCards <
    NAPOLEON_RULES.TARGET_FACE_CARDS
  ) {
    return {
      decided: true,
      napoleonWon: false,
      reason: 'Napoleon team cannot reach target face cards',
    }
  }

  return { decided: false }
}

/**
 * プレイヤーの統計情報を取得
 */
export function getPlayerStats(
  gameState: GameState,
  playerId: string
): {
  faceCardsWon: number
  cardsPlayed: number
  cardsInHand: number
  role: 'napoleon' | 'adjutant' | 'citizen'
} | null {
  const player = gameState.players.find((p) => p.id === playerId)
  if (!player) {
    return null
  }

  const faceCardsWon = getPlayerFaceCardCount(gameState, playerId)
  const cardsPlayed = gameState.tricks.reduce((count, trick) => {
    return (
      count + (trick.cards.some((card) => card.playerId === playerId) ? 1 : 0)
    )
  }, 0)

  // 現在のトリックでプレイしたカードも含める
  const currentTrickCards = gameState.currentTrick.cards.some(
    (card) => card.playerId === playerId
  )
    ? 1
    : 0

  const role = player.isNapoleon
    ? 'napoleon'
    : player.isAdjutant
      ? 'adjutant'
      : 'citizen'

  return {
    faceCardsWon,
    cardsPlayed: cardsPlayed + currentTrickCards,
    cardsInHand: player.hand.length,
    role,
  }
}
