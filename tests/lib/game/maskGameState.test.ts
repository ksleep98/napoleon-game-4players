/**
 * Tests for game state masking (F-3)
 */

import { GAME_PHASES, MASKED_CARD } from '@/lib/constants'
import { maskGameStateForPlayer } from '@/lib/game/maskGameState'
import type { Card, GameState, Player } from '@/types/game'

const createCard = (id: string, rank: Card['rank']): Card => ({
  id,
  suit: 'hearts',
  rank,
  value: 10,
})

const createPlayer = (id: string, hand: Card[]): Player => ({
  id,
  name: `Player ${id}`,
  hand,
  isNapoleon: false,
  isAdjutant: false,
  position: 1,
  isAI: false,
})

const createGameState = (): GameState => ({
  id: 'test-game',
  players: [
    createPlayer('me', [createCard('c1', 'A'), createCard('c2', 'K')]),
    createPlayer('other', [createCard('c3', 'Q'), createCard('c4', 'J')]),
  ],
  phase: GAME_PHASES.PLAYING,
  currentPlayerIndex: 0,
  currentTrick: { id: 'trick-1', cards: [], completed: false },
  tricks: [],
  hiddenCards: [createCard('h1', '3'), createCard('h2', '4')],
  exchangedCards: [createCard('e1', '5')],
  trumpSuit: 'spades',
  passedPlayers: [],
  declarationTurn: 0,
  needsRedeal: false,
  createdAt: new Date(),
  updatedAt: new Date(),
})

describe('maskGameStateForPlayer', () => {
  it('keeps the viewer hand intact', () => {
    const masked = maskGameStateForPlayer(createGameState(), 'me')
    const me = masked.players.find((p) => p.id === 'me')

    expect(me?.hand.map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('replaces other players hands with masked cards', () => {
    const masked = maskGameStateForPlayer(createGameState(), 'me')
    const other = masked.players.find((p) => p.id === 'other')

    expect(other?.hand).toHaveLength(2)
    for (const card of other?.hand ?? []) {
      expect(card.id.startsWith(MASKED_CARD.ID_PREFIX)).toBe(true)
    }
    expect(JSON.stringify(masked)).not.toContain('"c3"')
    expect(JSON.stringify(masked)).not.toContain('"c4"')
  })

  it('preserves hand length so card-count UI keeps working', () => {
    const masked = maskGameStateForPlayer(createGameState(), 'me')

    expect(masked.players.map((p) => p.hand.length)).toEqual([2, 2])
  })

  it('masks hidden cards and exchanged cards', () => {
    const masked = maskGameStateForPlayer(createGameState(), 'me')

    expect(masked.hiddenCards).toHaveLength(2)
    expect(JSON.stringify(masked.hiddenCards)).not.toContain('"h1"')
    expect(masked.exchangedCards).toHaveLength(1)
    expect(JSON.stringify(masked.exchangedCards)).not.toContain('"e1"')
  })

  it('does not mutate the original (server side) state', () => {
    const original = createGameState()
    maskGameStateForPlayer(original, 'me')

    expect(original.players[1].hand.map((c) => c.id)).toEqual(['c3', 'c4'])
    expect(original.hiddenCards.map((c) => c.id)).toEqual(['h1', 'h2'])
  })

  it('masks every hand when the viewer is not in the game', () => {
    const masked = maskGameStateForPlayer(createGameState(), 'outsider')

    for (const player of masked.players) {
      for (const card of player.hand) {
        expect(card.id.startsWith(MASKED_CARD.ID_PREFIX)).toBe(true)
      }
    }
  })
})
