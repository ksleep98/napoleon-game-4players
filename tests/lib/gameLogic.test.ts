import {
  createNewTrick,
  determineWinner,
  getCurrentPlayer,
  initializeGame,
} from '@/lib/gameLogic'
import type { GameState, Trick } from '@/types/game'

describe('Game Logic', () => {
  let gameState: GameState

  beforeEach(() => {
    const playerNames = ['Player 1', 'Player 2', 'Player 3', 'Player 4']
    gameState = initializeGame(playerNames)
  })

  describe('initializeGame', () => {
    it('should initialize game with correct structure', () => {
      expect(gameState.players).toHaveLength(4)
      expect(gameState.hiddenCards).toHaveLength(4)
      expect(gameState.currentTrick).toHaveProperty('id')
      expect(gameState.currentTrick).toHaveProperty('cards')
      expect(gameState.currentTrick).toHaveProperty('completed', false)
      expect(gameState.tricks).toEqual([])
      expect(gameState.phase).toBe('napoleon')
      expect(gameState.currentPlayerIndex).toBe(0)
    })

    it('should deal 12 cards to each player', () => {
      gameState.players.forEach((player) => {
        expect(player.hand).toHaveLength(12)
      })
    })

    it('should assign sequential player IDs', () => {
      expect(gameState.players[0].id).toBe('player_1')
      expect(gameState.players[1].id).toBe('player_2')
      expect(gameState.players[2].id).toBe('player_3')
      expect(gameState.players[3].id).toBe('player_4')
    })
  })

  describe('getCurrentPlayer', () => {
    it('should return the current player', () => {
      const currentPlayer = getCurrentPlayer(gameState)
      expect(currentPlayer).toBe(gameState.players[0])
    })
  })

  describe('createNewTrick', () => {
    it('should create a new empty trick', () => {
      const trick = createNewTrick()
      expect(trick).toHaveProperty('id')
      expect(trick.cards).toEqual([])
      expect(trick.completed).toBe(false)
    })
  })

  // isCardStronger function removed - logic integrated into determineWinner

  describe('determineWinner', () => {
    it('should determine winner of a complete trick', () => {
      const trick: Trick = {
        id: 'test-trick',
        cards: [
          {
            card: {
              id: 'hearts-7',
              suit: 'hearts' as const,
              rank: '7' as const,
              value: 7,
            },
            playerId: 'p1',
            order: 1,
          },
          {
            card: {
              id: 'hearts-K',
              suit: 'hearts' as const,
              rank: 'K' as const,
              value: 13,
            },
            playerId: 'p2',
            order: 2,
          },
          {
            card: {
              id: 'hearts-5',
              suit: 'hearts' as const,
              rank: '5' as const,
              value: 5,
            },
            playerId: 'p3',
            order: 3,
          },
          {
            card: {
              id: 'hearts-A',
              suit: 'hearts' as const,
              rank: 'A' as const,
              value: 14,
            },
            playerId: 'p4',
            order: 4,
          },
        ],
        completed: false,
        leadingSuit: 'hearts',
      }

      const winner = determineWinner(trick)
      expect(winner).not.toBeNull()
      expect(winner?.playerId).toBe('p4') // Player with Ace of Hearts should win
    })

    it('should return null for empty trick', () => {
      const emptyTrick: Trick = {
        id: 'empty-trick',
        cards: [],
        completed: false,
      }

      const winner = determineWinner(emptyTrick)
      expect(winner).toBeNull()
    })
  })
})
