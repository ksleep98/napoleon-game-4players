import { NAPOLEON_RULES } from '@/lib/constants'
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

  // ナポレオン・副官側が取ったトリック数を計算
  const napoleonTricks = gameState.tricks.filter(
    (trick) =>
      trick.winnerPlayerId === napoleonPlayer.id ||
      (adjutantPlayer && trick.winnerPlayerId === adjutantPlayer.id)
  ).length

  // ナポレオン側の勝利判定
  const napoleonWon = napoleonTricks >= NAPOLEON_RULES.TARGET_TRICKS

  // プレイヤーごとのスコアを計算
  const scores: PlayerScore[] = gameState.players.map((player) => {
    let points = 0
    let isWinner = false

    if (player.isNapoleon) {
      if (napoleonWon) {
        points =
          NAPOLEON_RULES.NAPOLEON_BONUS +
          napoleonTricks * NAPOLEON_RULES.BASE_POINTS
        isWinner = true
      } else {
        points = -(NAPOLEON_RULES.NAPOLEON_BONUS / 2) // ナポレオン失敗時のペナルティ
      }
    } else if (player.isAdjutant) {
      if (napoleonWon) {
        points =
          NAPOLEON_RULES.ADJUTANT_BONUS +
          (napoleonTricks * NAPOLEON_RULES.BASE_POINTS) / 2
        isWinner = true
      } else {
        points = -(NAPOLEON_RULES.ADJUTANT_BONUS / 2) // 副官失敗時のペナルティ
      }
    } else {
      // 市民側
      if (!napoleonWon) {
        // ナポレオン阻止成功時のボーナス（市民全員で分割）
        const citizenTricks = 12 - napoleonTricks
        points =
          NAPOLEON_RULES.NAPOLEON_BONUS / 2 +
          (citizenTricks * NAPOLEON_RULES.BASE_POINTS) / 2
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
    tricksWon: napoleonTricks,
    scores,
  }
}

/**
 * プレイヤーが取ったトリック数を計算
 */
export function getPlayerTrickCount(
  gameState: GameState,
  playerId: string
): number {
  return gameState.tricks.filter((trick) => trick.winnerPlayerId === playerId)
    .length
}

/**
 * 各チーム（ナポレオン側 vs 市民側）の取ったトリック数を計算
 */
export function getTeamTrickCounts(gameState: GameState): {
  napoleonTeam: number
  citizenTeam: number
} {
  const napoleonPlayer = gameState.players.find((p) => p.isNapoleon)
  const adjutantPlayer = gameState.players.find((p) => p.isAdjutant)

  const napoleonTeamIds = [napoleonPlayer?.id, adjutantPlayer?.id].filter(
    Boolean
  ) as string[]

  const napoleonTeam = gameState.tricks.filter(
    (trick) =>
      trick.winnerPlayerId && napoleonTeamIds.includes(trick.winnerPlayerId)
  ).length

  const citizenTeam = gameState.tricks.length - napoleonTeam

  return { napoleonTeam, citizenTeam }
}

/**
 * 現在のゲーム進行状況を取得
 */
export function getGameProgress(gameState: GameState): {
  tricksPlayed: number
  tricksRemaining: number
  napoleonTeamTricks: number
  citizenTeamTricks: number
  napoleonNeedsToWin: number
} {
  const { napoleonTeam, citizenTeam } = getTeamTrickCounts(gameState)
  const tricksPlayed = gameState.tricks.length
  const tricksRemaining = 12 - tricksPlayed
  const napoleonNeedsToWin = Math.max(
    0,
    NAPOLEON_RULES.TARGET_TRICKS - napoleonTeam
  )

  return {
    tricksPlayed,
    tricksRemaining,
    napoleonTeamTricks: napoleonTeam,
    citizenTeamTricks: citizenTeam,
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
  const { napoleonTeamTricks, tricksRemaining } = getGameProgress(gameState)

  // ナポレオン側が既に必要なトリック数を達成
  if (napoleonTeamTricks >= NAPOLEON_RULES.TARGET_TRICKS) {
    return {
      decided: true,
      napoleonWon: true,
      reason: 'Napoleon team reached target tricks',
    }
  }

  // ナポレオン側が残りトリックを全て取っても目標に届かない
  if (napoleonTeamTricks + tricksRemaining < NAPOLEON_RULES.TARGET_TRICKS) {
    return {
      decided: true,
      napoleonWon: false,
      reason: 'Napoleon team cannot reach target tricks',
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
  tricksWon: number
  cardsPlayed: number
  cardsInHand: number
  role: 'napoleon' | 'adjutant' | 'citizen'
} {
  const player = gameState.players.find((p) => p.id === playerId)
  if (!player) {
    throw new Error('Player not found')
  }

  const tricksWon = getPlayerTrickCount(gameState, playerId)
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
    tricksWon,
    cardsPlayed: cardsPlayed + currentTrickCards,
    cardsInHand: player.hand.length,
    role,
  }
}
