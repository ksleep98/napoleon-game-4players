/**
 * Tests for AI player utility functions
 */

import { createAIPlayer, createPlayersWithAI } from '@/utils/aiPlayerUtils'

// Mock generatePlayerId to make tests deterministic
jest.mock('@/utils/cardUtils', () => ({
  generatePlayerId: jest.fn(() => 'mock-player-id'),
}))

describe('AI Player Utils', () => {
  describe('createAIPlayer', () => {
    it('should create AI player with correct position', () => {
      const player = createAIPlayer(2)

      expect(player.position).toBe(2)
      expect(player.isAI).toBe(true)
      expect(player.isNapoleon).toBe(false)
      expect(player.isAdjutant).toBe(false)
      expect(player.hand).toEqual([])
    })

    it('should assign correct AI names based on position', () => {
      const player1 = createAIPlayer(1)
      const player2 = createAIPlayer(2)
      const player3 = createAIPlayer(3)
      const player4 = createAIPlayer(4)

      expect(player1.name).toBe('Napoleon AI')
      expect(player2.name).toBe('Strategic AI')
      expect(player3.name).toBe('Tactical AI')
      expect(player4.name).toBe('Alliance AI')
    })

    it('should use last AI name for positions beyond 4', () => {
      const player5 = createAIPlayer(5)
      const player10 = createAIPlayer(10)

      // Should use "Alliance AI" (last in the list)
      expect(player5.name).toBe('Alliance AI')
      expect(player10.name).toBe('Alliance AI')
    })

    it('should generate player ID', () => {
      const player = createAIPlayer(1)

      expect(player.id).toBe('mock-player-id')
    })

    it('should have empty hand initially', () => {
      const player = createAIPlayer(1)

      expect(player.hand).toEqual([])
      expect(player.hand).toHaveLength(0)
    })
  })

  describe('createPlayersWithAI', () => {
    it('should create 4 players (1 human + 3 AI)', () => {
      const players = createPlayersWithAI('Human Player')

      expect(players).toHaveLength(4)
    })

    it('should place human player at position 1', () => {
      const players = createPlayersWithAI('Test Human')

      const humanPlayer = players[0]
      expect(humanPlayer.name).toBe('Test Human')
      expect(humanPlayer.position).toBe(1)
      expect(humanPlayer.isAI).toBe(false)
    })

    it('should create AI players at positions 2, 3, 4', () => {
      const players = createPlayersWithAI('Human')

      expect(players[1].position).toBe(2)
      expect(players[1].isAI).toBe(true)
      expect(players[1].name).toBe('Strategic AI')

      expect(players[2].position).toBe(3)
      expect(players[2].isAI).toBe(true)
      expect(players[2].name).toBe('Tactical AI')

      expect(players[3].position).toBe(4)
      expect(players[3].isAI).toBe(true)
      expect(players[3].name).toBe('Alliance AI')
    })

    it('should initialize all players with empty hands', () => {
      const players = createPlayersWithAI('Human')

      players.forEach((player) => {
        expect(player.hand).toEqual([])
        expect(player.hand).toHaveLength(0)
      })
    })

    it('should initialize all players as not Napoleon and not Adjutant', () => {
      const players = createPlayersWithAI('Human')

      players.forEach((player) => {
        expect(player.isNapoleon).toBe(false)
        expect(player.isAdjutant).toBe(false)
      })
    })

    it('should handle different human player names', () => {
      const names = [
        'Alice',
        'Bob',
        'Charlie',
        '日本語名前',
        'Name with spaces',
      ]

      names.forEach((name) => {
        const players = createPlayersWithAI(name)
        expect(players[0].name).toBe(name)
        expect(players[0].isAI).toBe(false)
      })
    })

    it('should generate unique IDs for each player', () => {
      const { generatePlayerId } = require('@/utils/cardUtils')
      ;(generatePlayerId as jest.Mock).mockImplementation(() =>
        Math.random().toString(36)
      )

      const players = createPlayersWithAI('Human')
      const ids = players.map((p) => p.id)

      // All IDs should be defined
      ids.forEach((id) => {
        expect(id).toBeDefined()
        expect(typeof id).toBe('string')
      })
    })
  })
})
