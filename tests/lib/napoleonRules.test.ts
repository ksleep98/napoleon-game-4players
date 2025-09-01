import { GAME_PHASES, SUIT_ENUM } from '@/lib/constants'
import { initializeGame } from '@/lib/gameLogic'
import {
  canDeclareNapoleon,
  getMinimumDeclaration,
  isValidNapoleonDeclaration,
  MAX_NAPOLEON_FACE_CARDS,
  MIN_NAPOLEON_FACE_CARDS,
} from '@/lib/napoleonRules'
import type { GameState, NapoleonDeclaration } from '@/types/game'

describe('Napoleon Rules', () => {
  let gameState: GameState

  beforeEach(() => {
    const playerNames = ['Player 1', 'Player 2', 'Player 3', 'Player 4']
    gameState = initializeGame(playerNames)
  })

  describe('isValidNapoleonDeclaration', () => {
    it('should accept valid minimum declaration', () => {
      const declaration: NapoleonDeclaration = {
        playerId: 'player_1',
        targetTricks: MIN_NAPOLEON_FACE_CARDS,
        suit: SUIT_ENUM.CLUBS,
      }

      expect(isValidNapoleonDeclaration(declaration)).toBe(true)
    })

    it('should accept valid maximum declaration', () => {
      const declaration: NapoleonDeclaration = {
        playerId: 'player_1',
        targetTricks: MAX_NAPOLEON_FACE_CARDS,
        suit: SUIT_ENUM.SPADES,
      }

      expect(isValidNapoleonDeclaration(declaration)).toBe(true)
    })

    it('should reject declaration with too few face cards', () => {
      const declaration: NapoleonDeclaration = {
        playerId: 'player_1',
        targetTricks: MIN_NAPOLEON_FACE_CARDS - 1,
        suit: SUIT_ENUM.CLUBS,
      }

      expect(isValidNapoleonDeclaration(declaration)).toBe(false)
    })

    it('should reject declaration with too many face cards', () => {
      const declaration: NapoleonDeclaration = {
        playerId: 'player_1',
        targetTricks: MAX_NAPOLEON_FACE_CARDS + 1,
        suit: SUIT_ENUM.CLUBS,
      }

      expect(isValidNapoleonDeclaration(declaration)).toBe(false)
    })

    it('should accept higher face card count than current declaration', () => {
      const currentDeclaration: NapoleonDeclaration = {
        playerId: 'player_1',
        targetTricks: 13,
        suit: SUIT_ENUM.CLUBS,
      }

      const newDeclaration: NapoleonDeclaration = {
        playerId: 'player_2',
        targetTricks: 14,
        suit: SUIT_ENUM.CLUBS,
      }

      expect(
        isValidNapoleonDeclaration(newDeclaration, currentDeclaration)
      ).toBe(true)
    })

    it('should accept same face card count with stronger suit', () => {
      const currentDeclaration: NapoleonDeclaration = {
        playerId: 'player_1',
        targetTricks: 13,
        suit: SUIT_ENUM.CLUBS,
      }

      const newDeclaration: NapoleonDeclaration = {
        playerId: 'player_2',
        targetTricks: 13,
        suit: SUIT_ENUM.DIAMONDS,
      }

      expect(
        isValidNapoleonDeclaration(newDeclaration, currentDeclaration)
      ).toBe(true)
    })

    it('should reject same declaration (same face cards and suit)', () => {
      const currentDeclaration: NapoleonDeclaration = {
        playerId: 'player_1',
        targetTricks: 13,
        suit: SUIT_ENUM.CLUBS,
      }

      const newDeclaration: NapoleonDeclaration = {
        playerId: 'player_2',
        targetTricks: 13,
        suit: SUIT_ENUM.CLUBS,
      }

      expect(
        isValidNapoleonDeclaration(newDeclaration, currentDeclaration)
      ).toBe(false)
    })

    it('should reject weaker declaration (same face cards, weaker suit)', () => {
      const currentDeclaration: NapoleonDeclaration = {
        playerId: 'player_1',
        targetTricks: 13,
        suit: SUIT_ENUM.DIAMONDS,
      }

      const newDeclaration: NapoleonDeclaration = {
        playerId: 'player_2',
        targetTricks: 13,
        suit: SUIT_ENUM.CLUBS,
      }

      expect(
        isValidNapoleonDeclaration(newDeclaration, currentDeclaration)
      ).toBe(false)
    })
  })

  describe('getMinimumDeclaration', () => {
    it('should return minimum when no current declaration', () => {
      const result = getMinimumDeclaration()

      expect(result.minTricks).toBe(MIN_NAPOLEON_FACE_CARDS)
      expect(result.availableSuits).toEqual([
        SUIT_ENUM.SPADES,
        SUIT_ENUM.HEARTS,
        SUIT_ENUM.DIAMONDS,
        SUIT_ENUM.CLUBS,
      ])
    })

    it('should return higher face card count when no stronger suits available', () => {
      const currentDeclaration: NapoleonDeclaration = {
        playerId: 'player_1',
        targetTricks: 15,
        suit: SUIT_ENUM.SPADES, // 最強スート
      }

      const result = getMinimumDeclaration(currentDeclaration)

      expect(result.minTricks).toBe(16)
      expect(result.availableSuits).toEqual([
        SUIT_ENUM.SPADES,
        SUIT_ENUM.HEARTS,
        SUIT_ENUM.DIAMONDS,
        SUIT_ENUM.CLUBS,
      ])
    })

    it('should return stronger suits for same face card count', () => {
      const currentDeclaration: NapoleonDeclaration = {
        playerId: 'player_1',
        targetTricks: 15,
        suit: SUIT_ENUM.DIAMONDS,
      }

      const result = getMinimumDeclaration(currentDeclaration)

      expect(result.minTricks).toBe(15)
      expect(result.availableSuits).toContain(SUIT_ENUM.HEARTS)
      expect(result.availableSuits).toContain(SUIT_ENUM.SPADES)
      expect(result.availableSuits).toHaveLength(2)
    })

    it('should return only spades for hearts declaration', () => {
      const currentDeclaration: NapoleonDeclaration = {
        playerId: 'player_1',
        targetTricks: 15,
        suit: SUIT_ENUM.HEARTS,
      }

      const result = getMinimumDeclaration(currentDeclaration)

      expect(result.minTricks).toBe(15)
      expect(result.availableSuits).toEqual([SUIT_ENUM.SPADES])
    })

    it('should require higher face cards for strongest suit (spades)', () => {
      const currentDeclaration: NapoleonDeclaration = {
        playerId: 'player_1',
        targetTricks: 15,
        suit: SUIT_ENUM.SPADES,
      }

      const result = getMinimumDeclaration(currentDeclaration)

      expect(result.minTricks).toBe(16)
      expect(result.availableSuits).toEqual([
        SUIT_ENUM.SPADES,
        SUIT_ENUM.HEARTS,
        SUIT_ENUM.DIAMONDS,
        SUIT_ENUM.CLUBS,
      ])
    })
  })

  describe('canDeclareNapoleon', () => {
    it('should allow declaration in napoleon phase', () => {
      const playerId = gameState.players[0].id

      expect(canDeclareNapoleon(gameState, playerId)).toBe(true)
    })

    it('should not allow declaration in other phases', () => {
      const gameStateInWrongPhase = { ...gameState, phase: GAME_PHASES.PLAYING }
      const playerId = gameState.players[0].id

      expect(canDeclareNapoleon(gameStateInWrongPhase, playerId)).toBe(false)
    })

    it('should not allow declaration if player already passed', () => {
      const playerId = gameState.players[0].id
      const gameStateWithPass = {
        ...gameState,
        passedPlayers: [playerId],
      }

      expect(canDeclareNapoleon(gameStateWithPass, playerId)).toBe(false)
    })
  })
})
