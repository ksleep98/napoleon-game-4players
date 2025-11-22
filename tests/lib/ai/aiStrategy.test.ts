/**
 * AI戦略テスト
 */

import {
  type AIStrategyConfig,
  createCustomMCTSConfig,
  getStrategyConfigByDifficulty,
  selectAICard,
} from '@/lib/ai/aiStrategy'
import { GAME_PHASES, SUIT_ENUM } from '@/lib/constants'
import type { Card, GameState, Player } from '@/types/game'

// テスト用のモックデータ
function createMockCard(suit: string, rank: Card['rank'], value: number): Card {
  return {
    id: `${suit}-${rank}`,
    suit: suit as Card['suit'],
    rank,
    value,
  }
}

function createMockPlayer(id: string, position: number, isAI = true): Player {
  return {
    id,
    name: `Player ${id}`,
    hand: [
      createMockCard(SUIT_ENUM.SPADES, 'A', 14),
      createMockCard(SUIT_ENUM.HEARTS, 'K', 13),
      createMockCard(SUIT_ENUM.DIAMONDS, '10', 10),
    ],
    isAI,
    isNapoleon: false,
    isAdjutant: false,
    position,
  }
}

function createMockGameState(): GameState {
  return {
    id: 'test-game',
    phase: GAME_PHASES.PLAYING,
    players: [
      createMockPlayer('p1', 1, false),
      createMockPlayer('p2', 2, true),
      createMockPlayer('p3', 3, true),
      createMockPlayer('p4', 4, true),
    ],
    currentPlayerIndex: 0,
    currentTrick: {
      id: 'trick-1',
      cards: [],
      completed: false,
    },
    tricks: [],
    trumpSuit: SUIT_ENUM.SPADES,
    showingTrickResult: false,
    hiddenCards: [],
    passedPlayers: [],
    declarationTurn: 0,
    needsRedeal: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('AI Strategy', () => {
  describe('getStrategyConfigByDifficulty', () => {
    it('should return heuristic strategy for easy difficulty', () => {
      const config = getStrategyConfigByDifficulty('easy')
      expect(config.strategy).toBe('heuristic')
      expect(config.difficulty).toBe('easy')
    })

    it('should return hybrid strategy for normal difficulty', () => {
      const config = getStrategyConfigByDifficulty('normal')
      expect(config.strategy).toBe('hybrid')
      expect(config.difficulty).toBe('normal')
      expect(config.mctsConfig).toBeDefined()
    })

    it('should return hybrid strategy for hard difficulty', () => {
      const config = getStrategyConfigByDifficulty('hard')
      expect(config.strategy).toBe('hybrid')
      expect(config.difficulty).toBe('hard')
      expect(config.mctsConfig).toBeDefined()
    })
  })

  describe('createCustomMCTSConfig', () => {
    it('should create custom MCTS config', () => {
      const config = createCustomMCTSConfig(1000, 3000, 5)

      expect(config.simulationCount).toBe(1000)
      expect(config.timeLimit).toBe(3000)
      expect(config.determinizationCount).toBe(5)
      expect(config.explorationConstant).toBe(Math.sqrt(2))
    })
  })

  describe('selectAICard - heuristic strategy', () => {
    it('should select a card using heuristic strategy', () => {
      const gameState = createMockGameState()
      const player = gameState.players[1] // AI player
      const config: AIStrategyConfig = {
        strategy: 'heuristic',
        difficulty: 'easy',
      }

      const selectedCard = selectAICard(gameState, player, config)

      expect(selectedCard).toBeDefined()
      expect(selectedCard).not.toBeNull()
      if (selectedCard) {
        expect(player.hand).toContainEqual(selectedCard)
      }
    })

    it('should return null when no playable cards', () => {
      const gameState = createMockGameState()
      // 全プレイヤーの手札を空にする
      gameState.players = gameState.players.map((p) => ({ ...p, hand: [] }))
      const player = gameState.players[1]
      const config: AIStrategyConfig = {
        strategy: 'heuristic',
        difficulty: 'easy',
      }

      const selectedCard = selectAICard(gameState, player, config)

      expect(selectedCard).toBeNull()
    })
  })

  describe('selectAICard - game progress detection', () => {
    it('should use heuristic in early game (< 30%)', () => {
      const gameState = createMockGameState()
      gameState.tricks = [] // 0 tricks completed = early game
      const player = gameState.players[1]
      const config: AIStrategyConfig = {
        strategy: 'hybrid',
        difficulty: 'normal',
        mctsConfig: {
          simulationCount: 10, // Small for fast test
          timeLimit: 100,
          explorationConstant: Math.sqrt(2),
          determinizationCount: 1,
        },
      }

      const selectedCard = selectAICard(gameState, player, config)

      expect(selectedCard).toBeDefined()
      expect(selectedCard).not.toBeNull()
    })
  })
})
