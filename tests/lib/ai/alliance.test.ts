/**
 * Tests for Alliance AI strategy functions
 */

import { allianceAIStrategy, identifyAlliancePartners } from '@/lib/ai/alliance'
import { GAME_PHASES } from '@/lib/constants'
import type { Card, GameState, Player } from '@/types/game'

// Mock player creator
const createPlayer = (
  id: string,
  hand: Card[] = [],
  isNapoleon = false,
  isAdjutant = false
): Player => ({
  id,
  name: `Player ${id}`,
  hand,
  isNapoleon,
  isAdjutant,
  isAI: true,
  position: 1,
})

// Mock card creator
const createCard = (value: number): Card => ({
  id: `card-${value}`,
  suit: 'spades',
  rank: value >= 14 ? 'A' : value >= 13 ? 'K' : value >= 10 ? '10' : '5',
  value,
})

// Mock game state creator
const createGameState = (players: Player[]): GameState => ({
  id: 'test-game',
  players,
  phase: GAME_PHASES.PLAYING,
  currentPlayerIndex: 0,
  currentTrick: { id: 'trick-1', cards: [], completed: false },
  tricks: [],
  hiddenCards: [],
  trumpSuit: 'spades',
  passedPlayers: [],
  declarationTurn: 0,
  needsRedeal: false,
  createdAt: new Date(),
  updatedAt: new Date(),
})

describe('Alliance AI', () => {
  describe('allianceAIStrategy', () => {
    it('should target Napoleon with strong hand', () => {
      const strongHand = [
        createCard(14),
        createCard(13),
        createCard(12),
        createCard(11),
        createCard(10),
      ]
      const players = [
        createPlayer('p1', strongHand, false, false),
        createPlayer('p2', [], true, false), // Napoleon
        createPlayer('p3', [], false, false),
        createPlayer('p4', [], false, false),
      ]
      const gameState = createGameState(players)

      const result = allianceAIStrategy(gameState, 'p1')

      expect(result.targetNapoleon).toBe(true)
      expect(result.reasoning).toContain('strong hand')
    })

    it('should target Napoleon with weak hand (defensive)', () => {
      const weakHand = [createCard(5), createCard(4), createCard(3)]
      const players = [
        createPlayer('p1', weakHand, false, false),
        createPlayer('p2', [], true, false), // Napoleon
        createPlayer('p3', [], false, false),
        createPlayer('p4', [], false, false),
      ]
      const gameState = createGameState(players)

      const result = allianceAIStrategy(gameState, 'p1')

      expect(result.targetNapoleon).toBe(true)
      expect(result.reasoning).toContain('defensive play')
    })

    it('should target Napoleon with balanced hand', () => {
      // Balanced hand: 2-3 strong cards (value >= 10)
      const balancedHand = [
        createCard(12),
        createCard(11),
        createCard(10),
        createCard(7),
      ]
      const players = [
        createPlayer('p1', balancedHand, false, false),
        createPlayer('p2', [], true, false), // Napoleon
        createPlayer('p3', [], false, false),
        createPlayer('p4', [], false, false),
      ]
      const gameState = createGameState(players)

      const result = allianceAIStrategy(gameState, 'p1')

      expect(result.targetNapoleon).toBe(true)
      expect(result.reasoning).toContain('balanced approach')
    })

    it('should return default strategy when player not found', () => {
      const players = [
        createPlayer('p1', [], false, false),
        createPlayer('p2', [], true, false), // Napoleon
      ]
      const gameState = createGameState(players)

      const result = allianceAIStrategy(gameState, 'nonexistent')

      expect(result.targetNapoleon).toBe(true)
      expect(result.reasoning).toContain('Player not found')
    })

    it('should return default strategy when Napoleon not identified', () => {
      const players = [
        createPlayer('p1', [], false, false),
        createPlayer('p2', [], false, false), // No Napoleon
      ]
      const gameState = createGameState(players)

      const result = allianceAIStrategy(gameState, 'p1')

      expect(result.targetNapoleon).toBe(true)
      expect(result.reasoning).toContain('Napoleon not identified')
    })

    it('should work correctly with adjutant present', () => {
      const hand = [createCard(10), createCard(11)]
      const players = [
        createPlayer('p1', hand, false, false),
        createPlayer('p2', [], true, false), // Napoleon
        createPlayer('p3', [], false, true), // Adjutant
        createPlayer('p4', [], false, false),
      ]
      const gameState = createGameState(players)

      const result = allianceAIStrategy(gameState, 'p1')

      expect(result.targetNapoleon).toBe(true)
      expect(result.reasoning).toContain('Block Napoleon team')
    })
  })

  describe('identifyAlliancePartners', () => {
    it('should identify all alliance members (exclude Napoleon and Adjutant)', () => {
      const players = [
        createPlayer('p1', [], false, false), // Alliance
        createPlayer('p2', [], true, false), // Napoleon
        createPlayer('p3', [], false, true), // Adjutant
        createPlayer('p4', [], false, false), // Alliance
      ]
      const gameState = createGameState(players)

      const partners = identifyAlliancePartners(gameState, 'p1')

      expect(partners).toHaveLength(1)
      expect(partners).toContain('p4')
      expect(partners).not.toContain('p1') // Not self
      expect(partners).not.toContain('p2') // Not Napoleon
      expect(partners).not.toContain('p3') // Not Adjutant
    })

    it('should return empty array when all others are Napoleon team', () => {
      const players = [
        createPlayer('p1', [], false, false), // Alliance (only one)
        createPlayer('p2', [], true, false), // Napoleon
        createPlayer('p3', [], false, true), // Adjutant
      ]
      const gameState = createGameState(players)

      const partners = identifyAlliancePartners(gameState, 'p1')

      expect(partners).toHaveLength(0)
    })

    it('should work with only Napoleon (no Adjutant yet)', () => {
      const players = [
        createPlayer('p1', [], false, false), // Alliance
        createPlayer('p2', [], true, false), // Napoleon
        createPlayer('p3', [], false, false), // Alliance
        createPlayer('p4', [], false, false), // Alliance
      ]
      const gameState = createGameState(players)

      const partners = identifyAlliancePartners(gameState, 'p1')

      expect(partners).toHaveLength(2)
      expect(partners).toContain('p3')
      expect(partners).toContain('p4')
      expect(partners).not.toContain('p1') // Not self
      expect(partners).not.toContain('p2') // Not Napoleon
    })

    it('should identify correct partners for different alliance members', () => {
      const players = [
        createPlayer('p1', [], false, false), // Alliance
        createPlayer('p2', [], true, false), // Napoleon
        createPlayer('p3', [], false, true), // Adjutant
        createPlayer('p4', [], false, false), // Alliance
      ]
      const gameState = createGameState(players)

      // Check from p1's perspective
      const partnersP1 = identifyAlliancePartners(gameState, 'p1')
      expect(partnersP1).toEqual(['p4'])

      // Check from p4's perspective
      const partnersP4 = identifyAlliancePartners(gameState, 'p4')
      expect(partnersP4).toEqual(['p1'])
    })
  })
})
