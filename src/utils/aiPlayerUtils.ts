import type { Player } from '@/types/game'
import { generatePlayerId } from './cardUtils'

// AI プレイヤーの名前リスト
const AI_NAMES = ['Napoleon AI', 'Strategic AI', 'Tactical AI', 'Alliance AI']

// AI プレイヤーを作成
export function createAIPlayer(position: number): Player {
  return {
    id: generatePlayerId(),
    name: AI_NAMES[Math.min(position - 1, AI_NAMES.length - 1)],
    hand: [],
    isNapoleon: false,
    isAdjutant: false,
    position,
    isAI: true,
  }
}

// ゲーム用の4人プレイヤー（人間1人 + AI 3人）を作成
export function createPlayersWithAI(humanPlayerName: string): Player[] {
  const humanPlayer: Player = {
    id: generatePlayerId(),
    name: humanPlayerName,
    hand: [],
    isNapoleon: false,
    isAdjutant: false,
    position: 1,
    isAI: false,
  }

  const aiPlayers = [2, 3, 4].map((position) => createAIPlayer(position))

  return [humanPlayer, ...aiPlayers]
}
