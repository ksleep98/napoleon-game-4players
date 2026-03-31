/**
 * Tests for opponent modeling and learning system
 */

import {
  analyzeOpponents,
  buildActionHistories,
  calculateOpponentModelingBonus,
  generateOpponentPrediction,
  generatePlayerProfile,
  getOpponentModelingSummary,
  initializeActionHistory,
} from '@/lib/ai/strategies/opponentModeling'
import type { Card, GameState, PlayedCard, Player, Trick } from '@/types/game'

// Helper functions for creating mock data
function createMockCard(
  id: string,
  suit: 'spades' | 'hearts' | 'diamonds' | 'clubs',
  rank:
    | '2'
    | '3'
    | '4'
    | '5'
    | '6'
    | '7'
    | '8'
    | '9'
    | '10'
    | 'J'
    | 'Q'
    | 'K'
    | 'A',
  value: number
): Card {
  return {
    id,
    suit,
    rank,
    value,
  }
}

function createMockPlayer(
  id: string,
  name: string,
  isNapoleon: boolean = false,
  isAdjutant: boolean = false,
  hand: Card[] = []
): Player {
  return {
    id,
    name,
    hand,
    isNapoleon,
    isAdjutant,
    position: 1,
    isAI: true,
  }
}

function createMockPlayedCard(
  playerId: string,
  card: Card,
  order: number
): PlayedCard {
  return {
    playerId,
    card,
    order,
  }
}

function createMockTrick(
  cards: PlayedCard[],
  winnerPlayerId?: string,
  completed: boolean = false
): Trick {
  return {
    id: `trick-${Math.random()}`,
    cards,
    leadingSuit: cards[0]?.card.suit,
    winnerPlayerId,
    completed,
  }
}

function createMockGameState(
  players: Player[],
  tricks: Trick[],
  trumpSuit: 'spades' | 'hearts' | 'diamonds' | 'clubs' = 'spades'
): GameState {
  return {
    id: 'test-game',
    players,
    currentPlayerIndex: 0,
    currentTrick: createMockTrick([]),
    tricks,
    trumpSuit,
    leadingSuit: undefined,
    phase: 'playing',
    hiddenCards: [],
    passedPlayers: [],
    declarationTurn: 0,
    needsRedeal: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('opponentModeling', () => {
  describe('initializeActionHistory', () => {
    it('should create empty action history for a player', () => {
      const history = initializeActionHistory('player-1')

      expect(history.playerId).toBe('player-1')
      expect(history.totalTricks).toBe(0)
      expect(history.tricksWon).toBe(0)
      expect(history.tricksLost).toBe(0)
      expect(history.faceCardsPlayed).toBe(0)
      expect(history.faceCardsWon).toBe(0)
      expect(history.trumpsPlayed).toBe(0)
      expect(history.trumpsWonWith).toBe(0)
      expect(history.leadPlays).toBe(0)
      expect(history.followPlays).toBe(0)
      expect(history.aggressivePlays).toBe(0)
      expect(history.conservativePlays).toBe(0)
      expect(history.highValueCardsWasted).toBe(0)
      expect(history.bluffAttempts).toBe(0)
    })
  })

  describe('buildActionHistories', () => {
    it('should build action histories from completed tricks', () => {
      const players = [
        createMockPlayer('player-1', 'Player 1', true),
        createMockPlayer('player-2', 'Player 2'),
        createMockPlayer('player-3', 'Player 3'),
        createMockPlayer('player-4', 'Player 4'),
      ]

      const trick1 = createMockTrick(
        [
          createMockPlayedCard(
            'player-1',
            createMockCard('card-1', 'spades', 'A', 14),
            0
          ),
          createMockPlayedCard(
            'player-2',
            createMockCard('card-2', 'spades', '7', 7),
            1
          ),
          createMockPlayedCard(
            'player-3',
            createMockCard('card-3', 'spades', '8', 8),
            2
          ),
          createMockPlayedCard(
            'player-4',
            createMockCard('card-4', 'spades', '9', 9),
            3
          ),
        ],
        'player-1',
        true
      )

      const gameState = createMockGameState(players, [trick1], 'spades')
      const histories = buildActionHistories(gameState)

      expect(histories.size).toBe(4)
      expect(histories.get('player-1')?.totalTricks).toBe(1)
      expect(histories.get('player-1')?.tricksWon).toBe(1)
      expect(histories.get('player-1')?.faceCardsPlayed).toBe(1)
      expect(histories.get('player-2')?.tricksLost).toBe(1)
    })

    it('should handle multiple completed tricks', () => {
      const players = [
        createMockPlayer('player-1', 'Player 1', true),
        createMockPlayer('player-2', 'Player 2'),
        createMockPlayer('player-3', 'Player 3'),
        createMockPlayer('player-4', 'Player 4'),
      ]

      const trick1 = createMockTrick(
        [
          createMockPlayedCard(
            'player-1',
            createMockCard('card-1', 'spades', 'A', 14),
            0
          ),
          createMockPlayedCard(
            'player-2',
            createMockCard('card-2', 'spades', '7', 7),
            1
          ),
          createMockPlayedCard(
            'player-3',
            createMockCard('card-3', 'spades', '8', 8),
            2
          ),
          createMockPlayedCard(
            'player-4',
            createMockCard('card-4', 'spades', '9', 9),
            3
          ),
        ],
        'player-1',
        true
      )

      const trick2 = createMockTrick(
        [
          createMockPlayedCard(
            'player-2',
            createMockCard('card-5', 'hearts', 'K', 13),
            0
          ),
          createMockPlayedCard(
            'player-3',
            createMockCard('card-6', 'hearts', '7', 7),
            1
          ),
          createMockPlayedCard(
            'player-4',
            createMockCard('card-7', 'hearts', '8', 8),
            2
          ),
          createMockPlayedCard(
            'player-1',
            createMockCard('card-8', 'hearts', '9', 9),
            3
          ),
        ],
        'player-2',
        true
      )

      const gameState = createMockGameState(players, [trick1, trick2], 'spades')
      const histories = buildActionHistories(gameState)

      expect(histories.get('player-1')?.totalTricks).toBe(2)
      expect(histories.get('player-1')?.tricksWon).toBe(1)
      expect(histories.get('player-2')?.totalTricks).toBe(2)
      expect(histories.get('player-2')?.tricksWon).toBe(1)
      expect(histories.get('player-2')?.faceCardsPlayed).toBe(1)
    })

    it('should not include incomplete tricks', () => {
      const players = [
        createMockPlayer('player-1', 'Player 1', true),
        createMockPlayer('player-2', 'Player 2'),
        createMockPlayer('player-3', 'Player 3'),
        createMockPlayer('player-4', 'Player 4'),
      ]

      const trick1 = createMockTrick(
        [
          createMockPlayedCard(
            'player-1',
            createMockCard('card-1', 'spades', 'A', 14),
            0
          ),
          createMockPlayedCard(
            'player-2',
            createMockCard('card-2', 'spades', '7', 7),
            1
          ),
        ],
        undefined,
        false
      )

      const gameState = createMockGameState(players, [trick1], 'spades')
      const histories = buildActionHistories(gameState)

      expect(histories.get('player-1')?.totalTricks).toBe(0)
      expect(histories.get('player-2')?.totalTricks).toBe(0)
    })
  })

  describe('generatePlayerProfile', () => {
    it('should generate profile from action history', () => {
      const history = {
        playerId: 'player-1',
        totalTricks: 10,
        tricksWon: 6,
        tricksLost: 4,
        faceCardsPlayed: 4,
        faceCardsWon: 3,
        trumpsPlayed: 5,
        trumpsWonWith: 4,
        leadPlays: 5,
        followPlays: 5,
        aggressivePlays: 7,
        conservativePlays: 3,
        highValueCardsWasted: 1,
        bluffAttempts: 2,
      }

      const profile = generatePlayerProfile(history)

      expect(profile.playerId).toBe('player-1')
      expect(profile.aggressiveness).toBe(0.7) // 7/10
      expect(profile.riskTolerance).toBeGreaterThan(0)
      expect(profile.bluffingTendency).toBe(0.2) // 2/10
      expect(profile.faceCardPreservation).toBe(0.75) // 3/4
      expect(profile.confidence).toBe(1.0) // 10 tricks = full confidence
      expect(profile.predictability).toBeGreaterThan(0)
    })

    it('should handle zero tricks (new player)', () => {
      const history = initializeActionHistory('player-1')
      const profile = generatePlayerProfile(history)

      expect(profile.playerId).toBe('player-1')
      expect(profile.aggressiveness).toBe(0)
      expect(profile.confidence).toBe(0.1) // Min confidence with no data (1 trick default)
    })

    it('should calculate confidence based on data amount', () => {
      const history1 = { ...initializeActionHistory('p1'), totalTricks: 3 }
      const history2 = { ...initializeActionHistory('p2'), totalTricks: 10 }
      const history3 = { ...initializeActionHistory('p3'), totalTricks: 20 }

      const profile1 = generatePlayerProfile(history1)
      const profile2 = generatePlayerProfile(history2)
      const profile3 = generatePlayerProfile(history3)

      expect(profile1.confidence).toBe(0.3)
      expect(profile2.confidence).toBe(1.0)
      expect(profile3.confidence).toBe(1.0) // Capped at 1.0
    })

    it('should identify trump usage patterns', () => {
      const historyEarly = {
        ...initializeActionHistory('early'),
        totalTricks: 9,
        trumpsPlayed: 6, // 6 trumps in 9 tricks = 6/(9/3) = 2.0 > 0.6 = early
      }

      const historyLate = {
        ...initializeActionHistory('late'),
        totalTricks: 12,
        trumpsPlayed: 1, // 1 trump in 12 tricks = 1/(12/3) = 0.25 < 0.3 = late
      }

      const historyBalanced = {
        ...initializeActionHistory('balanced'),
        totalTricks: 12,
        trumpsPlayed: 2, // 2 trumps in 12 tricks = 2/(12/3) = 0.5, balanced
      }

      const profileEarly = generatePlayerProfile(historyEarly)
      const profileLate = generatePlayerProfile(historyLate)
      const profileBalanced = generatePlayerProfile(historyBalanced)

      expect(profileEarly.trumpUsagePattern).toBe('early')
      expect(profileLate.trumpUsagePattern).toBe('late')
      expect(profileBalanced.trumpUsagePattern).toBe('balanced')
    })
  })

  describe('generateOpponentPrediction', () => {
    it('should predict aggressive play style', () => {
      const profile = {
        playerId: 'player-1',
        aggressiveness: 0.8,
        riskTolerance: 0.7,
        bluffingTendency: 0.2,
        trumpUsagePattern: 'balanced' as const,
        faceCardPreservation: 0.6,
        predictability: 0.5,
        confidence: 0.9,
      }

      const player = createMockPlayer('player-1', 'Player 1')
      const gameState = createMockGameState([player], [], 'spades')

      const prediction = generateOpponentPrediction(profile, player, gameState)

      expect(prediction.playerId).toBe('player-1')
      expect(prediction.likelyNextPlay).toBe('aggressive')
      expect(prediction.expectedStrength).toBeGreaterThan(0.5)
      expect(prediction.confidence).toBe(0.9)
    })

    it('should predict conservative play style', () => {
      const profile = {
        playerId: 'player-2',
        aggressiveness: 0.2,
        riskTolerance: 0.1,
        bluffingTendency: 0.05,
        trumpUsagePattern: 'late' as const,
        faceCardPreservation: 0.8,
        predictability: 0.6,
        confidence: 0.8,
      }

      const player = createMockPlayer('player-2', 'Player 2')
      const gameState = createMockGameState([player], [], 'spades')

      const prediction = generateOpponentPrediction(profile, player, gameState)

      expect(prediction.likelyNextPlay).toBe('conservative')
      expect(prediction.expectedStrength).toBeLessThan(0.3)
    })

    it('should identify vulnerabilities', () => {
      const profile = {
        playerId: 'player-3',
        aggressiveness: 0.5,
        riskTolerance: 0.2,
        bluffingTendency: 0.4,
        trumpUsagePattern: 'early' as const,
        faceCardPreservation: 0.3,
        predictability: 0.8,
        confidence: 0.7,
      }

      const player = createMockPlayer('player-3', 'Player 3')
      const gameState = createMockGameState([player], [], 'spades')

      const prediction = generateOpponentPrediction(profile, player, gameState)

      expect(prediction.vulnerabilities).toContain('low_late_game_trumps')
      expect(prediction.vulnerabilities).toContain('wastes_face_cards')
      expect(prediction.vulnerabilities).toContain('too_conservative')
      expect(prediction.vulnerabilities).toContain('frequent_bluffer')
      expect(prediction.vulnerabilities).toContain('highly_predictable')
    })

    it('should return unpredictable when confidence is low', () => {
      const profile = {
        playerId: 'player-4',
        aggressiveness: 0.5,
        riskTolerance: 0.5,
        bluffingTendency: 0.1,
        trumpUsagePattern: 'balanced' as const,
        faceCardPreservation: 0.5,
        predictability: 0.5,
        confidence: 0.3, // Low confidence
      }

      const player = createMockPlayer('player-4', 'Player 4')
      const gameState = createMockGameState([player], [], 'spades')

      const prediction = generateOpponentPrediction(profile, player, gameState)

      expect(prediction.likelyNextPlay).toBe('unpredictable')
    })
  })

  describe('analyzeOpponents', () => {
    it('should analyze all opponents in game', () => {
      const players = [
        createMockPlayer('napoleon', 'Napoleon', true),
        createMockPlayer('player-2', 'Player 2'),
        createMockPlayer('player-3', 'Player 3'),
        createMockPlayer('player-4', 'Player 4'),
      ]

      const trick1 = createMockTrick(
        [
          createMockPlayedCard(
            'napoleon',
            createMockCard('card-1', 'spades', 'A', 14),
            0
          ),
          createMockPlayedCard(
            'player-2',
            createMockCard('card-2', 'spades', 'K', 13),
            1
          ),
          createMockPlayedCard(
            'player-3',
            createMockCard('card-3', 'spades', '7', 7),
            2
          ),
          createMockPlayedCard(
            'player-4',
            createMockCard('card-4', 'spades', '8', 8),
            3
          ),
        ],
        'napoleon',
        true
      )

      const gameState = createMockGameState(players, [trick1], 'spades')
      const currentPlayer = players[0] // Napoleon

      const result = analyzeOpponents(gameState, currentPlayer)

      expect(result.profiles.size).toBe(3) // Excludes current player
      expect(result.predictions.size).toBe(3)
      expect(result.strategicAdjustments.size).toBe(3)
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0)
    })

    it('should exclude current player from analysis', () => {
      const players = [
        createMockPlayer('player-1', 'Player 1'),
        createMockPlayer('player-2', 'Player 2'),
      ]

      const gameState = createMockGameState(players, [], 'spades')
      const currentPlayer = players[0]

      const result = analyzeOpponents(gameState, currentPlayer)

      expect(result.profiles.has('player-1')).toBe(false)
      expect(result.profiles.has('player-2')).toBe(true)
    })

    it('should calculate strategic adjustments', () => {
      const players = [
        createMockPlayer('napoleon', 'Napoleon', true),
        createMockPlayer('player-2', 'Player 2'),
        createMockPlayer('player-3', 'Player 3'),
        createMockPlayer('player-4', 'Player 4'),
      ]

      // Create multiple tricks with clear patterns
      const tricks: Trick[] = []
      for (let i = 0; i < 10; i++) {
        const trick = createMockTrick(
          [
            createMockPlayedCard(
              'napoleon',
              createMockCard(`n-${i}`, 'spades', 'A', 14),
              0
            ),
            createMockPlayedCard(
              'player-2',
              createMockCard(`p2-${i}`, 'spades', 'K', 13),
              1
            ),
            createMockPlayedCard(
              'player-3',
              createMockCard(`p3-${i}`, 'spades', '7', 7),
              2
            ),
            createMockPlayedCard(
              'player-4',
              createMockCard(`p4-${i}`, 'spades', '8', 8),
              3
            ),
          ],
          i % 2 === 0 ? 'napoleon' : 'player-2',
          true
        )
        tricks.push(trick)
      }

      const gameState = createMockGameState(players, tricks, 'spades')
      const currentPlayer = players[0]

      const result = analyzeOpponents(gameState, currentPlayer)

      expect(result.strategicAdjustments.size).toBe(3)
      // Some adjustments should be non-zero for predictable opponents
      const adjustmentValues = Array.from(result.strategicAdjustments.values())
      expect(adjustmentValues.some((adj) => adj > 0)).toBe(true)
    })
  })

  describe('calculateOpponentModelingBonus', () => {
    it('should return 0 when confidence is too low', () => {
      const card = createMockCard('card-1', 'spades', 'A', 14)
      const playableCards = [card]
      const players = [
        createMockPlayer('p1', 'P1'),
        createMockPlayer('p2', 'P2'),
      ]
      const gameState = createMockGameState(players, [], 'spades')
      const player = players[0]

      const modelingResult = {
        profiles: new Map(),
        predictions: new Map(),
        strategicAdjustments: new Map(),
        overallConfidence: 0.2, // Too low
      }

      const bonus = calculateOpponentModelingBonus(
        card,
        playableCards,
        gameState,
        player,
        modelingResult
      )

      expect(bonus).toBe(0)
    })

    it('should apply bonus for aggressive next player', () => {
      const weakCard = createMockCard('weak', 'hearts', '7', 7)
      const strongCard = createMockCard('strong', 'spades', 'A', 14)
      const playableCards = [weakCard, strongCard]

      const players = [
        createMockPlayer('p1', 'P1'),
        createMockPlayer('p2', 'P2'),
        createMockPlayer('p3', 'P3'),
        createMockPlayer('p4', 'P4'),
      ]
      const gameState = createMockGameState(players, [], 'spades')
      const player = players[0]

      const modelingResult = {
        profiles: new Map([
          [
            'p2',
            {
              playerId: 'p2',
              aggressiveness: 0.8,
              riskTolerance: 0.7,
              bluffingTendency: 0.1,
              trumpUsagePattern: 'early' as const,
              faceCardPreservation: 0.5,
              predictability: 0.6,
              confidence: 0.8,
            },
          ],
        ]),
        predictions: new Map([
          [
            'p2',
            {
              playerId: 'p2',
              likelyCards: [],
              likelyNextPlay: 'aggressive' as const,
              expectedStrength: 0.7,
              vulnerabilities: [],
              confidence: 0.8,
            },
          ],
        ]),
        strategicAdjustments: new Map([['p2', 20]]),
        overallConfidence: 0.8,
      }

      const bonusWeak = calculateOpponentModelingBonus(
        weakCard,
        playableCards,
        gameState,
        player,
        modelingResult
      )
      const bonusStrong = calculateOpponentModelingBonus(
        strongCard,
        playableCards,
        gameState,
        player,
        modelingResult
      )

      expect(bonusWeak).toBeGreaterThan(bonusStrong) // Weak card bonus when next player is aggressive
    })

    it('should apply bonus for conservative next player', () => {
      const weakCard = createMockCard('weak', 'hearts', '7', 7)
      const strongCard = createMockCard('strong', 'spades', 'A', 14)
      const playableCards = [weakCard, strongCard]

      const players = [
        createMockPlayer('p1', 'P1'),
        createMockPlayer('p2', 'P2'),
        createMockPlayer('p3', 'P3'),
        createMockPlayer('p4', 'P4'),
      ]
      const gameState = createMockGameState(players, [], 'spades')
      const player = players[0]

      const modelingResult = {
        profiles: new Map([
          [
            'p2',
            {
              playerId: 'p2',
              aggressiveness: 0.2,
              riskTolerance: 0.1,
              bluffingTendency: 0.05,
              trumpUsagePattern: 'late' as const,
              faceCardPreservation: 0.8,
              predictability: 0.6,
              confidence: 0.8,
            },
          ],
        ]),
        predictions: new Map([
          [
            'p2',
            {
              playerId: 'p2',
              likelyCards: [],
              likelyNextPlay: 'conservative' as const,
              expectedStrength: 0.3,
              vulnerabilities: [],
              confidence: 0.8,
            },
          ],
        ]),
        strategicAdjustments: new Map([['p2', 15]]),
        overallConfidence: 0.8,
      }

      const bonusWeak = calculateOpponentModelingBonus(
        weakCard,
        playableCards,
        gameState,
        player,
        modelingResult
      )
      const bonusStrong = calculateOpponentModelingBonus(
        strongCard,
        playableCards,
        gameState,
        player,
        modelingResult
      )

      expect(bonusStrong).toBeGreaterThan(bonusWeak) // Strong card bonus when next player is conservative
    })

    it('should scale bonus by overall confidence', () => {
      const card = createMockCard('card', 'spades', 'A', 14)
      const playableCards = [card]
      const players = [
        createMockPlayer('p1', 'P1'),
        createMockPlayer('p2', 'P2'),
      ]
      const gameState = createMockGameState(players, [], 'spades')
      const player = players[0]

      const modelingResultHighConf = {
        profiles: new Map(),
        predictions: new Map(),
        strategicAdjustments: new Map([['p2', 50]]),
        overallConfidence: 0.9,
      }

      const modelingResultLowConf = {
        profiles: new Map(),
        predictions: new Map(),
        strategicAdjustments: new Map([['p2', 50]]),
        overallConfidence: 0.5,
      }

      const bonusHigh = calculateOpponentModelingBonus(
        card,
        playableCards,
        gameState,
        player,
        modelingResultHighConf
      )
      const bonusLow = calculateOpponentModelingBonus(
        card,
        playableCards,
        gameState,
        player,
        modelingResultLowConf
      )

      expect(bonusHigh).toBeGreaterThan(bonusLow)
    })
  })

  describe('getOpponentModelingSummary', () => {
    it('should generate summary text', () => {
      const modelingResult = {
        profiles: new Map([
          [
            'p1',
            {
              playerId: 'p1',
              aggressiveness: 0.8,
              riskTolerance: 0.7,
              bluffingTendency: 0.1,
              trumpUsagePattern: 'early' as const,
              faceCardPreservation: 0.6,
              predictability: 0.5,
              confidence: 0.9,
            },
          ],
          [
            'p2',
            {
              playerId: 'p2',
              aggressiveness: 0.3,
              riskTolerance: 0.2,
              bluffingTendency: 0.05,
              trumpUsagePattern: 'late' as const,
              faceCardPreservation: 0.8,
              predictability: 0.7,
              confidence: 0.8,
            },
          ],
        ]),
        predictions: new Map([
          [
            'p1',
            {
              playerId: 'p1',
              likelyCards: [],
              likelyNextPlay: 'aggressive' as const,
              expectedStrength: 0.7,
              vulnerabilities: ['low_late_game_trumps', 'wastes_face_cards'],
              confidence: 0.9,
            },
          ],
          [
            'p2',
            {
              playerId: 'p2',
              likelyCards: [],
              likelyNextPlay: 'conservative' as const,
              expectedStrength: 0.3,
              vulnerabilities: ['too_conservative'],
              confidence: 0.8,
            },
          ],
        ]),
        strategicAdjustments: new Map([
          ['p1', 30],
          ['p2', 25],
        ]),
        overallConfidence: 0.85,
      }

      const summary = getOpponentModelingSummary(modelingResult)

      expect(summary).toContain('p1')
      expect(summary).toContain('p2')
      expect(summary).toContain('Aggressive')
      expect(summary).toContain('Conservative')
      expect(summary).toContain('2 weaknesses')
      expect(summary).toContain('1 weaknesses')
    })

    it('should skip low-confidence profiles', () => {
      const modelingResult = {
        profiles: new Map([
          [
            'p1',
            {
              playerId: 'p1',
              aggressiveness: 0.5,
              riskTolerance: 0.5,
              bluffingTendency: 0.1,
              trumpUsagePattern: 'balanced' as const,
              faceCardPreservation: 0.5,
              predictability: 0.5,
              confidence: 0.2, // Too low
            },
          ],
        ]),
        predictions: new Map([
          [
            'p1',
            {
              playerId: 'p1',
              likelyCards: [],
              likelyNextPlay: 'unpredictable' as const,
              expectedStrength: 0.5,
              vulnerabilities: [],
              confidence: 0.2,
            },
          ],
        ]),
        strategicAdjustments: new Map([['p1', 0]]),
        overallConfidence: 0.2,
      }

      const summary = getOpponentModelingSummary(modelingResult)

      expect(summary).toBe('') // No profiles meet confidence threshold
    })
  })
})
