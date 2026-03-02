/**
 * probabilisticDecision.ts のユニットテスト
 * Probabilistic decision making tests
 */

import {
  calculateProbabilisticBonus,
  evaluateAllCardsProbability,
  evaluateCardProbability,
} from '@/lib/ai/strategies/probabilisticDecision'
import type { CardCountingInfo } from '@/lib/ai/strategies/types'
import type { Card, GameState, Player, Trick } from '@/types/game'

// ===== Mock Helper Functions =====

function createMockCard(
  id: string,
  suit: 'spades' | 'hearts' | 'diamonds' | 'clubs',
  rank: Card['rank'],
  value = 10
): Card {
  return { id, suit, rank, value }
}

function createMockPlayer(
  id: string,
  name: string,
  isNapoleon = false,
  isAdjutant = false,
  hand: Card[] = []
): Player {
  return {
    id,
    name,
    hand,
    isNapoleon,
    isAdjutant,
    position: 0,
    isAI: false,
  }
}

function createMockGameState(
  players: Player[],
  tricks: Trick[] = [],
  currentTrick: Trick
): GameState {
  return {
    id: 'test-game-id',
    players,
    currentPlayerIndex: 0,
    trumpSuit: 'spades',
    tricks,
    currentTrick,
    napoleonCard: undefined,
    napoleonDeclaration: {
      playerId: 'napoleon-1',
      suit: 'spades',
      targetTricks: 8,
      adjutantCard: createMockCard('adj-card', 'hearts', 'A'),
    },
    showingTrickResult: false,
    lastCompletedTrick: undefined,
    phase: 'playing',
    hiddenCards: [],
    passedPlayers: [],
    declarationTurn: 0,
    needsRedeal: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function createMockTrick(
  leadingSuit?: 'spades' | 'hearts' | 'diamonds' | 'clubs',
  cards: Array<{ playerId: string; card: Card }> = []
): Trick {
  return {
    id: `trick-${Math.random()}`,
    leadingSuit,
    cards: cards.map((c, index) => ({
      playerId: c.playerId,
      card: c.card,
      order: index,
      revealsAdjutant: false,
    })),
    winnerPlayerId: undefined,
    completed: false,
  }
}

function createMockCardCounting(): CardCountingInfo {
  return {
    suitTracking: new Map([
      [
        'spades',
        {
          suit: 'spades',
          playedCards: [],
          remainingCards: 13,
          playedFaceCards: [],
          remainingFaceCards: 4,
          myCards: [],
          myFaceCards: [],
          hasHighCards: false,
        },
      ],
      [
        'hearts',
        {
          suit: 'hearts',
          playedCards: [],
          remainingCards: 13,
          playedFaceCards: [],
          remainingFaceCards: 4,
          myCards: [],
          myFaceCards: [],
          hasHighCards: false,
        },
      ],
    ]),
    totalPlayedCards: 20,
    totalRemainingCards: 32,
    totalPlayedFaceCards: 4,
    totalRemainingFaceCards: 9,
  }
}

function createMockRequirements() {
  return {
    napoleonTeamFaceCards: 3,
    allianceTeamFaceCards: 2,
    remainingFaceCards: 8,
    remainingTricks: 7,
    napoleonNeedsToWin: 5,
    allianceNeedsToBlock: 4,
    napoleonCanAffordToLose: 3,
    isNapoleonAhead: false,
    isAllianceAhead: false,
    isCriticalPhase: false,
  }
}

// ===== Tests =====

describe('probabilisticDecision', () => {
  describe('evaluateCardProbability', () => {
    it('should return probabilistic result with valid values', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false, [
        createMockCard('card-1', 'spades', 'A', 14),
        createMockCard('card-2', 'hearts', 'K', 13),
      ])
      const players = [napoleon]

      const completedTricks = Array.from({ length: 5 }, () => createMockTrick())
      const currentTrick = createMockTrick()
      const gameState = createMockGameState(
        players,
        completedTricks as Trick[],
        currentTrick
      )

      const playableCards = napoleon.hand
      const cardCounting = createMockCardCounting()
      const requirements = createMockRequirements()

      const result = evaluateCardProbability(
        playableCards[0],
        playableCards,
        gameState,
        napoleon,
        cardCounting,
        requirements
      )

      expect(result).toBeDefined()
      expect(result.winProbability).toBeGreaterThanOrEqual(0)
      expect(result.winProbability).toBeLessThanOrEqual(1)
      expect(result.expectedFaceCards).toBeGreaterThanOrEqual(0)
      expect(result.variance).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
      expect(result.contributionScore).toBeGreaterThanOrEqual(0)
      expect(result.contributionScore).toBeLessThanOrEqual(100)
    })

    it('should give higher win probability for Napoleon with strong card', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false, [
        createMockCard('strong', 'spades', 'A', 14),
        createMockCard('weak', 'hearts', '7', 7),
      ])
      const players = [napoleon]

      const completedTricks = Array.from({ length: 5 }, () => createMockTrick())
      const currentTrick = createMockTrick()
      const gameState = createMockGameState(
        players,
        completedTricks as Trick[],
        currentTrick
      )

      const cardCounting = createMockCardCounting()
      const requirements = createMockRequirements()

      const strongResult = evaluateCardProbability(
        napoleon.hand[0],
        napoleon.hand,
        gameState,
        napoleon,
        cardCounting,
        requirements
      )

      const weakResult = evaluateCardProbability(
        napoleon.hand[1],
        napoleon.hand,
        gameState,
        napoleon,
        cardCounting,
        requirements
      )

      // Strong card should have higher contribution score
      expect(strongResult.contributionScore).toBeGreaterThan(
        weakResult.contributionScore
      )
    })

    it('should calculate confidence based on information availability', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false, [
        createMockCard('card-1', 'spades', 'A', 14),
      ])
      const players = [napoleon]

      // Early game: low information
      const earlyTricks = Array.from({ length: 2 }, () => createMockTrick())
      const earlyGameState = createMockGameState(
        players,
        earlyTricks as Trick[],
        createMockTrick()
      )
      const earlyCardCounting = createMockCardCounting()
      earlyCardCounting.totalPlayedCards = 8
      const earlyRequirements = createMockRequirements()
      earlyRequirements.remainingTricks = 10

      // Late game: high information
      const lateTricks = Array.from({ length: 10 }, () => createMockTrick())
      const lateGameState = createMockGameState(
        players,
        lateTricks as Trick[],
        createMockTrick()
      )
      const lateCardCounting = createMockCardCounting()
      lateCardCounting.totalPlayedCards = 40
      const lateRequirements = createMockRequirements()
      lateRequirements.remainingTricks = 2

      const earlyResult = evaluateCardProbability(
        napoleon.hand[0],
        napoleon.hand,
        earlyGameState,
        napoleon,
        earlyCardCounting,
        earlyRequirements
      )

      const lateResult = evaluateCardProbability(
        napoleon.hand[0],
        napoleon.hand,
        lateGameState,
        napoleon,
        lateCardCounting,
        lateRequirements
      )

      // Late game should have higher confidence
      expect(lateResult.confidence).toBeGreaterThan(earlyResult.confidence)
    })

    it('should handle Alliance player perspective', () => {
      const alliance = createMockPlayer(
        'alliance-1',
        'Alliance',
        false,
        false,
        [createMockCard('card-1', 'spades', 'K', 13)]
      )
      const players = [alliance]

      const completedTricks = Array.from({ length: 5 }, () => createMockTrick())
      const currentTrick = createMockTrick()
      const gameState = createMockGameState(
        players,
        completedTricks as Trick[],
        currentTrick
      )

      const cardCounting = createMockCardCounting()
      const requirements = createMockRequirements()

      const result = evaluateCardProbability(
        alliance.hand[0],
        alliance.hand,
        gameState,
        alliance,
        cardCounting,
        requirements
      )

      expect(result).toBeDefined()
      expect(result.winProbability).toBeGreaterThanOrEqual(0)
      expect(result.winProbability).toBeLessThanOrEqual(1)
    })

    it('should increase variance with more remaining tricks', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false, [
        createMockCard('card-1', 'spades', 'A', 14),
      ])
      const players = [napoleon]

      // Few remaining tricks
      const fewTricks = Array.from({ length: 10 }, () => createMockTrick())
      const fewTricksState = createMockGameState(
        players,
        fewTricks as Trick[],
        createMockTrick()
      )
      const fewRequirements = createMockRequirements()
      fewRequirements.remainingTricks = 2

      // Many remaining tricks
      const manyTricks = Array.from({ length: 2 }, () => createMockTrick())
      const manyTricksState = createMockGameState(
        players,
        manyTricks as Trick[],
        createMockTrick()
      )
      const manyRequirements = createMockRequirements()
      manyRequirements.remainingTricks = 10

      const cardCounting = createMockCardCounting()

      const fewResult = evaluateCardProbability(
        napoleon.hand[0],
        napoleon.hand,
        fewTricksState,
        napoleon,
        cardCounting,
        fewRequirements
      )

      const manyResult = evaluateCardProbability(
        napoleon.hand[0],
        napoleon.hand,
        manyTricksState,
        napoleon,
        cardCounting,
        manyRequirements
      )

      // More remaining tricks should have higher variance
      expect(manyResult.variance).toBeGreaterThan(fewResult.variance)
    })
  })

  describe('evaluateAllCardsProbability', () => {
    it('should evaluate all playable cards', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false, [
        createMockCard('card-1', 'spades', 'A', 14),
        createMockCard('card-2', 'hearts', 'K', 13),
        createMockCard('card-3', 'diamonds', 'Q', 12),
      ])
      const players = [napoleon]

      const completedTricks = Array.from({ length: 5 }, () => createMockTrick())
      const currentTrick = createMockTrick()
      const gameState = createMockGameState(
        players,
        completedTricks as Trick[],
        currentTrick
      )

      const playableCards = napoleon.hand
      const cardCounting = createMockCardCounting()
      const requirements = createMockRequirements()

      const results = evaluateAllCardsProbability(
        playableCards,
        gameState,
        napoleon,
        cardCounting,
        requirements
      )

      expect(results).toHaveLength(3)
      for (const result of results) {
        expect(result.card).toBeDefined()
        expect(result.winProbability).toBeGreaterThanOrEqual(0)
        expect(result.winProbability).toBeLessThanOrEqual(1)
        expect(result.riskScore).toBeGreaterThanOrEqual(0)
        expect(result.riskScore).toBeLessThanOrEqual(1)
        expect(result.opportunityScore).toBeGreaterThanOrEqual(0)
      }
    })

    it('should return empty array for no playable cards', () => {
      const napoleon = createMockPlayer(
        'napoleon-1',
        'Napoleon',
        true,
        false,
        []
      )
      const players = [napoleon]

      const completedTricks = Array.from({ length: 5 }, () => createMockTrick())
      const currentTrick = createMockTrick()
      const gameState = createMockGameState(
        players,
        completedTricks as Trick[],
        currentTrick
      )

      const cardCounting = createMockCardCounting()
      const requirements = createMockRequirements()

      const results = evaluateAllCardsProbability(
        [],
        gameState,
        napoleon,
        cardCounting,
        requirements
      )

      expect(results).toHaveLength(0)
    })

    it('should calculate risk score based on variance', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false, [
        createMockCard('card-1', 'spades', 'A', 14),
      ])
      const players = [napoleon]

      const completedTricks = Array.from({ length: 5 }, () => createMockTrick())
      const currentTrick = createMockTrick()
      const gameState = createMockGameState(
        players,
        completedTricks as Trick[],
        currentTrick
      )

      const cardCounting = createMockCardCounting()
      const requirements = createMockRequirements()

      const results = evaluateAllCardsProbability(
        napoleon.hand,
        gameState,
        napoleon,
        cardCounting,
        requirements
      )

      expect(results[0].riskScore).toBeGreaterThanOrEqual(0)
      expect(results[0].riskScore).toBeLessThanOrEqual(1)
    })
  })

  describe('calculateProbabilisticBonus', () => {
    it('should return positive bonus for Napoleon team with high win probability', () => {
      const probabilisticResult = {
        winProbability: 0.9,
        expectedFaceCards: 8,
        variance: 1.0,
        confidence: 0.9,
        contributionScore: 80,
      }
      const requirements = createMockRequirements()

      const bonus = calculateProbabilisticBonus(
        probabilisticResult,
        requirements,
        true // Napoleon team
      )

      expect(bonus).toBeGreaterThan(0)
    })

    it('should return negative bonus for Alliance team with high Napoleon win probability', () => {
      const probabilisticResult = {
        winProbability: 0.9, // High Napoleon win probability
        expectedFaceCards: 8,
        variance: 1.0,
        confidence: 0.9,
        contributionScore: 80,
      }
      const requirements = createMockRequirements()

      const bonus = calculateProbabilisticBonus(
        probabilisticResult,
        requirements,
        false // Alliance team
      )

      expect(bonus).toBeLessThan(0)
    })

    it('should apply urgency multiplier for critical phase', () => {
      const probabilisticResult = {
        winProbability: 0.8,
        expectedFaceCards: 7,
        variance: 1.0,
        confidence: 0.9,
        contributionScore: 70,
      }

      const normalRequirements = createMockRequirements()
      normalRequirements.isCriticalPhase = false

      const criticalRequirements = createMockRequirements()
      criticalRequirements.isCriticalPhase = true

      const normalBonus = calculateProbabilisticBonus(
        probabilisticResult,
        normalRequirements,
        true
      )

      const criticalBonus = calculateProbabilisticBonus(
        probabilisticResult,
        criticalRequirements,
        true
      )

      // Critical phase should give higher bonus
      expect(criticalBonus).toBeGreaterThan(normalBonus)
    })

    it('should apply urgency multiplier when team is ahead', () => {
      const probabilisticResult = {
        winProbability: 0.8,
        expectedFaceCards: 9,
        variance: 1.0,
        confidence: 0.9,
        contributionScore: 70,
      }

      const normalRequirements = createMockRequirements()
      normalRequirements.isNapoleonAhead = false

      const aheadRequirements = createMockRequirements()
      aheadRequirements.isNapoleonAhead = true

      const normalBonus = calculateProbabilisticBonus(
        probabilisticResult,
        normalRequirements,
        true // Napoleon team
      )

      const aheadBonus = calculateProbabilisticBonus(
        probabilisticResult,
        aheadRequirements,
        true // Napoleon team
      )

      // When ahead, should give lower bonus (more conservative)
      expect(aheadBonus).toBeLessThan(normalBonus)
    })

    it('should scale bonus with confidence', () => {
      const lowConfidenceResult = {
        winProbability: 0.8,
        expectedFaceCards: 7,
        variance: 1.0,
        confidence: 0.3,
        contributionScore: 70,
      }

      const highConfidenceResult = {
        winProbability: 0.8,
        expectedFaceCards: 7,
        variance: 1.0,
        confidence: 0.9,
        contributionScore: 70,
      }

      const requirements = createMockRequirements()

      const lowConfidenceBonus = calculateProbabilisticBonus(
        lowConfidenceResult,
        requirements,
        true
      )

      const highConfidenceBonus = calculateProbabilisticBonus(
        highConfidenceResult,
        requirements,
        true
      )

      // Higher confidence should give higher bonus
      expect(highConfidenceBonus).toBeGreaterThan(lowConfidenceBonus)
    })

    it('should scale bonus with contribution score', () => {
      const lowContributionResult = {
        winProbability: 0.8,
        expectedFaceCards: 7,
        variance: 1.0,
        confidence: 0.9,
        contributionScore: 30,
      }

      const highContributionResult = {
        winProbability: 0.8,
        expectedFaceCards: 7,
        variance: 1.0,
        confidence: 0.9,
        contributionScore: 90,
      }

      const requirements = createMockRequirements()

      const lowContributionBonus = calculateProbabilisticBonus(
        lowContributionResult,
        requirements,
        true
      )

      const highContributionBonus = calculateProbabilisticBonus(
        highContributionResult,
        requirements,
        true
      )

      // Higher contribution should give higher bonus
      expect(highContributionBonus).toBeGreaterThan(lowContributionBonus)
    })

    it('should return reasonable bonus magnitude', () => {
      const probabilisticResult = {
        winProbability: 0.7,
        expectedFaceCards: 7,
        variance: 1.5,
        confidence: 0.8,
        contributionScore: 60,
      }
      const requirements = createMockRequirements()

      const bonus = calculateProbabilisticBonus(
        probabilisticResult,
        requirements,
        true
      )

      // Bonus should be reasonable for card selection scoring
      expect(Math.abs(bonus)).toBeLessThan(200)
    })
  })
})
