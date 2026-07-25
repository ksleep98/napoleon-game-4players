import { GAME_PHASES } from '@/lib/constants'
import type { Card, GameState, PlayedCard } from '@/types/game'
import {
  checkAdjutantRevealed,
  isAdjutantIdentityPublic,
} from '@/utils/gameUtils'

const adjutantCard: Card = {
  id: 'adjutant-card',
  suit: 'hearts',
  rank: 'A',
  value: 14,
}

const createGameState = (overrides: Partial<GameState> = {}): GameState => ({
  id: 'test-game',
  players: [],
  phase: GAME_PHASES.PLAYING,
  currentPlayerIndex: 0,
  currentTrick: { id: 'trick-1', cards: [], completed: false },
  tricks: [],
  hiddenCards: [],
  napoleonCard: adjutantCard,
  passedPlayers: [],
  declarationTurn: 0,
  needsRedeal: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const playedAdjutantCard: PlayedCard = {
  card: adjutantCard,
  playerId: 'adjutant',
  order: 0,
}

describe('isAdjutantIdentityPublic', () => {
  it('is false while the designation card has not been played', () => {
    expect(isAdjutantIdentityPublic(createGameState())).toBe(false)
  })

  it('is true once the designation card is in a completed trick', () => {
    const state = createGameState({
      tricks: [
        {
          id: 'trick-0',
          cards: [playedAdjutantCard],
          completed: true,
          winnerPlayerId: 'adjutant',
        },
      ],
    })

    expect(checkAdjutantRevealed(state)).toBe(true)
    expect(isAdjutantIdentityPublic(state)).toBe(true)
  })

  it('is true when a played card carries the revealsAdjutant flag', () => {
    const state = createGameState({
      currentTrick: {
        id: 'trick-1',
        cards: [{ ...playedAdjutantCard, revealsAdjutant: true }],
        completed: false,
      },
    })

    expect(isAdjutantIdentityPublic(state)).toBe(true)
  })

  it('is true when the game is finished even if the card was never played', () => {
    const state = createGameState({ phase: GAME_PHASES.FINISHED })

    expect(checkAdjutantRevealed(state)).toBe(false)
    expect(isAdjutantIdentityPublic(state)).toBe(true)
  })
})
