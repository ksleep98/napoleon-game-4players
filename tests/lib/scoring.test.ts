import { initializeGame } from '@/lib/gameLogic'
import {
  calculateGameResult,
  getGameProgress,
  getPlayerFaceCardCount,
  getTeamFaceCardCounts,
  isGameDecided,
} from '@/lib/scoring'
import type { Card, GameState, Trick } from '@/types/game'

describe('Scoring', () => {
  let mockGameState: GameState

  beforeEach(() => {
    const playerNames = ['Player 1', 'Player 2', 'Player 3', 'Player 4']
    mockGameState = initializeGame(playerNames)

    // Set up Napoleon and Adjutant
    mockGameState.players[0].isNapoleon = true
    mockGameState.players[1].isAdjutant = true
    mockGameState.tricks = []
  })

  const createCard = (id: string, suit: any, rank: any): Card => ({
    id,
    suit,
    rank,
    value: 10,
  })

  describe('getTeamFaceCardCounts', () => {
    it('should calculate correct counts with no completed tricks', () => {
      const counts = getTeamFaceCardCounts(mockGameState)
      expect(counts.napoleonTeam).toBe(0)
      expect(counts.citizenTeam).toBe(20) // 全絵札数 - ナポレオンの絵札数
    })

    it('should calculate correct counts with some face cards won', () => {
      // Mock tricks with face cards - トリックに絵札を含めたモックを作成
      const tricks: Trick[] = [
        {
          id: 'trick1',
          cards: [
            {
              card: createCard('spades-A', 'spades', 'A'),
              playerId: 'player_1',
              order: 1,
            },
            {
              card: createCard('hearts-2', 'hearts', '2'),
              playerId: 'player_2',
              order: 2,
            },
          ],
          completed: true,
          winnerPlayerId: 'player_1', // Napoleon wins with A
        },
        {
          id: 'trick2',
          cards: [
            {
              card: createCard('clubs-K', 'clubs', 'K'),
              playerId: 'player_3',
              order: 1,
            },
            {
              card: createCard('diamonds-Q', 'diamonds', 'Q'),
              playerId: 'player_4',
              order: 2,
            },
          ],
          completed: true,
          winnerPlayerId: 'player_3', // Citizen wins with K, Q
        },
      ]

      mockGameState.tricks = tricks
      const counts = getTeamFaceCardCounts(mockGameState)

      expect(counts.napoleonTeam).toBe(1) // A = 1 face card
      expect(counts.citizenTeam).toBe(19) // 20 - 1 = 19
    })
  })

  describe('getGameProgress', () => {
    it('should calculate correct progress with no completed tricks', () => {
      const progress = getGameProgress(mockGameState)
      expect(progress.napoleonTeamFaceCards).toBe(0)
      expect(progress.citizenTeamFaceCards).toBe(20)
      expect(progress.tricksPlayed).toBe(0)
      expect(progress.tricksRemaining).toBe(12)
      expect(progress.napoleonNeedsToWin).toBe(11) // TARGET_FACE_CARDS
    })

    it('should calculate correct progress with some completed tricks', () => {
      mockGameState.tricks = [
        {
          id: 'trick1',
          cards: [
            {
              card: createCard('spades-A', 'spades', 'A'),
              playerId: 'player_1',
              order: 1,
            },
            {
              card: createCard('hearts-2', 'hearts', '2'),
              playerId: 'player_2',
              order: 2,
            },
          ],
          completed: true,
          winnerPlayerId: 'player_1',
        },
        {
          id: 'trick2',
          cards: [
            {
              card: createCard('clubs-3', 'clubs', '3'),
              playerId: 'player_3',
              order: 1,
            },
            {
              card: createCard('diamonds-4', 'diamonds', '4'),
              playerId: 'player_4',
              order: 2,
            },
          ],
          completed: true,
          winnerPlayerId: 'player_3',
        },
      ]

      const progress = getGameProgress(mockGameState)

      expect(progress.napoleonTeamFaceCards).toBe(1) // Napoleon won A
      expect(progress.citizenTeamFaceCards).toBe(19) // 20 - 1
      expect(progress.tricksPlayed).toBe(2)
      expect(progress.tricksRemaining).toBe(10)
      expect(progress.napoleonNeedsToWin).toBe(10) // 11 - 1 = 10
    })
  })

  describe('isGameDecided', () => {
    it('should return false for undecided game', () => {
      const decision = isGameDecided(mockGameState)
      expect(decision.decided).toBe(false)
    })

    it('should return true when Napoleon team reaches target face cards', () => {
      // Mock Napoleon team winning 11+ face cards
      mockGameState.tricks = Array(11)
        .fill(null)
        .map((_, i) => ({
          id: `trick${i}`,
          cards: [
            {
              card: createCard(`card${i}`, 'spades', 'A'),
              playerId: 'player_1',
              order: 1,
            },
          ],
          completed: true,
          winnerPlayerId: 'player_1',
        }))

      const decision = isGameDecided(mockGameState)
      expect(decision.decided).toBe(true)
      expect(decision.napoleonWon).toBe(true)
      expect(decision.reason).toBe('Napoleon team reached target face cards')
    })

    it('should return true when Napoleon team cannot reach target face cards', () => {
      // Mock scenario where Napoleon cannot reach 11 face cards
      // Napoleon has won 2 face cards, only 1 trick remaining with max 5 face cards
      mockGameState.tricks = [
        {
          id: 'napoleon-trick1',
          cards: [
            {
              card: createCard('spades-A', 'spades', 'A'),
              playerId: 'player_1',
              order: 1,
            },
            {
              card: createCard('hearts-K', 'hearts', 'K'),
              playerId: 'player_2',
              order: 2,
            },
          ],
          completed: true,
          winnerPlayerId: 'player_1', // Napoleon wins 2 face cards
        },
        ...Array(10)
          .fill(null)
          .map((_, i) => ({
            id: `citizen-trick${i}`,
            cards: [
              {
                card: createCard(`card${i}`, 'clubs', '2'),
                playerId: 'player_3',
                order: 1,
              },
            ],
            completed: true,
            winnerPlayerId: 'player_3', // Citizens win non-face cards
          })),
      ]

      const decision = isGameDecided(mockGameState)
      expect(decision.decided).toBe(true)
      expect(decision.napoleonWon).toBe(false)
      expect(decision.reason).toBe(
        'Napoleon team cannot reach target face cards'
      )
    })
  })

  describe('getPlayerFaceCardCount', () => {
    it('should count face cards won by specific player', () => {
      mockGameState.tricks = [
        {
          id: 'trick1',
          cards: [
            {
              card: createCard('spades-A', 'spades', 'A'),
              playerId: 'player_1',
              order: 1,
            },
            {
              card: createCard('hearts-K', 'hearts', 'K'),
              playerId: 'player_2',
              order: 2,
            },
          ],
          completed: true,
          winnerPlayerId: 'player_1', // wins 2 face cards
        },
        {
          id: 'trick2',
          cards: [
            {
              card: createCard('clubs-Q', 'clubs', 'Q'),
              playerId: 'player_1',
              order: 1,
            },
            {
              card: createCard('diamonds-2', 'diamonds', '2'),
              playerId: 'player_2',
              order: 2,
            },
          ],
          completed: true,
          winnerPlayerId: 'player_1', // wins 1 face card
        },
        {
          id: 'trick3',
          cards: [
            {
              card: createCard('spades-10', 'spades', '10'),
              playerId: 'player_3',
              order: 1,
            },
            {
              card: createCard('hearts-3', 'hearts', '3'),
              playerId: 'player_4',
              order: 2,
            },
          ],
          completed: true,
          winnerPlayerId: 'player_3', // wins 1 face card (10)
        },
      ]

      expect(getPlayerFaceCardCount(mockGameState, 'player_1')).toBe(3) // A, K, Q
      expect(getPlayerFaceCardCount(mockGameState, 'player_3')).toBe(1) // 10
      expect(getPlayerFaceCardCount(mockGameState, 'player_2')).toBe(0)
    })
  })

  describe('calculateGameResult', () => {
    it('should calculate Napoleon team victory', () => {
      // Mock Napoleon team winning 11+ face cards
      mockGameState.tricks = Array(11)
        .fill(null)
        .map((_, i) => ({
          id: `trick${i}`,
          cards: [
            {
              card: createCard(`card${i}`, 'spades', 'A'),
              playerId: 'player_1',
              order: 1,
            },
          ],
          completed: true,
          winnerPlayerId: 'player_1',
        }))

      const result = calculateGameResult(mockGameState)
      expect(result.napoleonWon).toBe(true)
      expect(result.napoleonPlayerId).toBe('player_1')
      expect(result.faceCardsWon).toBe(11)

      const napoleonScore = result.scores.find((s) => s.playerId === 'player_1')
      expect(napoleonScore?.isWinner).toBe(true)
      expect(napoleonScore?.points).toBeGreaterThan(0)
    })

    it('should calculate Citizen victory', () => {
      // Mock Napoleon team winning only 10 face cards (less than 11)
      mockGameState.tricks = [
        ...Array(10)
          .fill(null)
          .map((_, i) => ({
            id: `napoleon-trick${i}`,
            cards: [
              {
                card: createCard(`napoleon-card${i}`, 'spades', 'A'),
                playerId: 'player_1',
                order: 1,
              },
            ],
            completed: true,
            winnerPlayerId: 'player_1', // Napoleon wins 10 face cards
          })),
        {
          id: 'citizen-trick1',
          cards: [
            {
              card: createCard('citizen-card1', 'hearts', '2'),
              playerId: 'player_3',
              order: 1,
            },
          ],
          completed: true,
          winnerPlayerId: 'player_3', // Citizen wins non-face card
        },
      ]

      const result = calculateGameResult(mockGameState)
      expect(result.napoleonWon).toBe(false)
      expect(result.faceCardsWon).toBe(10)

      const citizenScore = result.scores.find((s) => s.playerId === 'player_3')
      expect(citizenScore?.isWinner).toBe(true)
    })
  })
})
