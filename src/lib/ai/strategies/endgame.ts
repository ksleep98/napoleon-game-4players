/**
 * Endgame strategy functions for AI card selection
 * 終盤戦略関連の関数
 */

import type { GameState, Player } from '@/types/game'
import { isFaceCard } from './helpers'
import type { EndgameInfo, WinningRequirements } from './types'

/**
 * 終盤状態を分析
 * 残りトリック数と目標達成状況から、終盤の戦略を決定
 */
export function analyzeEndgameState(
  gameState: GameState,
  player: Player
): EndgameInfo {
  // 残りトリック数を計算（12トリック - 完了したトリック）
  const totalTricks = 12
  const completedTricks = gameState.tricks.length
  const remainingTricks = totalTricks - completedTricks

  // 終盤の定義: 残り3トリック以下
  const isEndgame = remainingTricks <= 3

  // 自分の残り手札枚数
  const remainingCardsInHand = player.hand.length

  // 各チームの絵札獲得数を計算（calculateWinningRequirementsと同様のロジック）
  const totalFaceCards = 13
  const napoleonTarget = gameState.napoleonDeclaration?.targetTricks || 8

  let napoleonTeamFaceCards = 0
  let allianceTeamFaceCards = 0

  // 完了したトリックから絵札を集計
  for (const trick of gameState.tricks) {
    if (!trick.winnerPlayerId) continue

    const winnerPlayer = gameState.players.find(
      (p) => p.id === trick.winnerPlayerId
    )
    if (!winnerPlayer) continue

    const faceCardsInTrick = trick.cards.filter((tc) =>
      isFaceCard(tc.card)
    ).length

    if (winnerPlayer.isNapoleon || winnerPlayer.isAdjutant) {
      napoleonTeamFaceCards += faceCardsInTrick
    } else {
      allianceTeamFaceCards += faceCardsInTrick
    }
  }

  // 残り絵札数
  const remainingFaceCards =
    totalFaceCards - napoleonTeamFaceCards - allianceTeamFaceCards

  // ナポレオンチームが必要な残り絵札数
  const napoleonNeedsToWin = napoleonTarget - napoleonTeamFaceCards

  // 連合軍が阻止するために取るべき絵札数
  const allianceNeedsToBlock = napoleonTarget - allianceTeamFaceCards

  // 勝利確定判定
  const canSecureNapoleonVictory = napoleonTeamFaceCards >= napoleonTarget
  const canSecureAllianceVictory = napoleonNeedsToWin > remainingFaceCards

  // 残り全絵札を取る必要があるか
  const napoleonNeedsAllRemaining =
    napoleonNeedsToWin === remainingFaceCards && remainingFaceCards > 0
  const allianceNeedsAllRemaining =
    allianceNeedsToBlock === remainingFaceCards && remainingFaceCards > 0

  return {
    isEndgame,
    remainingTricks,
    remainingCardsInHand,
    canSecureNapoleonVictory,
    canSecureAllianceVictory,
    napoleonNeedsAllRemaining,
    allianceNeedsAllRemaining,
  }
}

/**
 * 保守的にプレイすべきか判断
 * 目標達成済みまたは大幅リード時は安全策を取る
 */
export function shouldPlayConservatively(
  player: Player,
  requirements: WinningRequirements
): boolean {
  if (player.isNapoleon || player.isAdjutant) {
    // ナポレオンチーム: 既に目標達成済み、または大幅にリードしている場合
    if (requirements.napoleonNeedsToWin === 0) {
      return true // 目標達成済みなら保守的にプレイ
    }

    // 残り絵札が少なく、失っても良い絵札数が多い場合（余裕がある）
    if (
      requirements.napoleonCanAffordToLose >= 3 &&
      requirements.remainingTricks >= 4
    ) {
      return true
    }
  } else {
    // 連合軍: 既に阻止達成済み、または大幅にリードしている場合
    if (requirements.allianceNeedsToBlock === 0) {
      return true // 阻止達成済みなら保守的にプレイ
    }

    // ナポレオンが目標達成不可能な状況（連合軍の勝利確定）
    if (requirements.napoleonNeedsToWin > requirements.remainingTricks) {
      return true
    }
  }

  return false
}

/**
 * 攻撃的にプレイすべきか判断
 * 劣勢または重要局面では積極的にプレイ
 */
export function shouldPlayAggressively(
  player: Player,
  requirements: WinningRequirements
): boolean {
  if (player.isNapoleon || player.isAdjutant) {
    // ナポレオンチーム: 目標まであと少し、または劣勢の場合
    if (
      requirements.napoleonNeedsToWin > 0 &&
      requirements.napoleonNeedsToWin <= 2 &&
      requirements.isCriticalPhase
    ) {
      return true // 重要局面で目標まであと1-2枚なら攻撃的
    }

    // 劣勢（必要枚数が残りトリック数に対して多い）
    if (requirements.napoleonNeedsToWin >= requirements.remainingTricks / 2) {
      return true
    }
  } else {
    // 連合軍: ナポレオンが優勢で阻止が危うい場合
    if (
      requirements.isNapoleonAhead &&
      requirements.allianceNeedsToBlock > 0 &&
      requirements.isCriticalPhase
    ) {
      return true // ナポレオン優勢の重要局面なら攻撃的にブロック
    }

    // ナポレオンが目標まであと1-2枚（危機的状況）
    if (
      requirements.napoleonNeedsToWin > 0 &&
      requirements.napoleonNeedsToWin <= 2
    ) {
      return true
    }
  }

  return false
}
