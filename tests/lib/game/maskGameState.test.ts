/**
 * Tests for game state masking (F-3)
 */

import { GAME_PHASES, MASKED_CARD } from '@/lib/constants'
import {
  maskAdjutantIdentityForPlayer,
  maskGameStateForPlayer,
  restoreAdjutantIdentity,
} from '@/lib/game/maskGameState'
import type { Card, GameState, PlayedCard, Player, Trick } from '@/types/game'

const createCard = (id: string, rank: Card['rank']): Card => ({
  id,
  suit: 'hearts',
  rank,
  value: 10,
})

/** 副官指定カード（ナポレオンが宣言時に指定した公開情報） */
const adjutantDesignationCard = createCard('adjutant-card', 'A')

const createPlayer = (id: string, hand: Card[]): Player => ({
  id,
  name: `Player ${id}`,
  hand,
  isNapoleon: false,
  isAdjutant: false,
  position: 1,
  isAI: false,
})

const createGameState = (overrides: Partial<GameState> = {}): GameState => ({
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
  ...overrides,
})

/** 副官が 'other'、ナポレオンが 'me' の状態を作る */
const createAdjutantGameState = (
  overrides: Partial<GameState> = {}
): GameState => {
  const base = createGameState(overrides)
  return {
    ...base,
    players: base.players.map((player) =>
      player.id === 'other'
        ? { ...player, isAdjutant: true }
        : { ...player, isNapoleon: player.id === 'me' }
    ),
    napoleonCard: adjutantDesignationCard,
  }
}

const createCompletedTrick = (cards: PlayedCard[]): Trick => ({
  id: 'trick-played',
  cards,
  completed: true,
  winnerPlayerId: cards[0]?.playerId,
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

describe('maskGameStateForPlayer - adjutant identity', () => {
  describe('before the adjutant designation card is played', () => {
    it('hides another player isAdjutant flag', () => {
      const masked = maskGameStateForPlayer(createAdjutantGameState(), 'me')
      const other = masked.players.find((p) => p.id === 'other')

      expect(other?.isAdjutant).toBe(false)
    })

    it('does not leak the adjutant flag anywhere in the payload', () => {
      const masked = maskGameStateForPlayer(createAdjutantGameState(), 'me')

      expect(JSON.stringify(masked)).not.toContain('"isAdjutant":true')
    })

    it('hides the adjutant from Napoleon as well', () => {
      const state = createAdjutantGameState()
      const napoleon = state.players.find((p) => p.isNapoleon)
      const masked = maskGameStateForPlayer(state, napoleon?.id ?? '')

      expect(masked.players.find((p) => p.id === 'other')?.isAdjutant).toBe(
        false
      )
    })

    it('keeps the adjutant own flag visible to themselves', () => {
      const masked = maskGameStateForPlayer(createAdjutantGameState(), 'other')
      const me = masked.players.find((p) => p.id === 'other')

      expect(me?.isAdjutant).toBe(true)
    })

    it('does not mutate the original (server side) state', () => {
      const original = createAdjutantGameState()
      maskGameStateForPlayer(original, 'me')

      expect(original.players.find((p) => p.id === 'other')?.isAdjutant).toBe(
        true
      )
    })

    it('keeps the public isNapoleon flag untouched', () => {
      const masked = maskGameStateForPlayer(createAdjutantGameState(), 'other')

      expect(masked.players.find((p) => p.id === 'me')?.isNapoleon).toBe(true)
    })
  })

  describe('after the adjutant is revealed', () => {
    it('exposes isAdjutant once the designation card is in a completed trick', () => {
      const state = createAdjutantGameState({
        tricks: [
          createCompletedTrick([
            { card: adjutantDesignationCard, playerId: 'other', order: 0 },
          ]),
        ],
      })
      const masked = maskGameStateForPlayer(state, 'me')

      expect(masked.players.find((p) => p.id === 'other')?.isAdjutant).toBe(
        true
      )
    })

    it('exposes isAdjutant when Napoleon played it from the hidden cards (revealsAdjutant)', () => {
      const revealingCard: PlayedCard = {
        card: adjutantDesignationCard,
        playerId: 'me',
        order: 0,
        revealsAdjutant: true,
      }
      const state = createAdjutantGameState({
        currentTrick: {
          id: 'trick-1',
          cards: [revealingCard],
          completed: false,
        },
      })
      const masked = maskGameStateForPlayer(state, 'me')

      expect(masked.players.find((p) => p.id === 'other')?.isAdjutant).toBe(
        true
      )
    })

    it('exposes isAdjutant when the game is finished', () => {
      const state = createAdjutantGameState({ phase: GAME_PHASES.FINISHED })
      const masked = maskGameStateForPlayer(state, 'me')

      expect(masked.players.find((p) => p.id === 'other')?.isAdjutant).toBe(
        true
      )
    })

    it('still masks other players hands after the reveal', () => {
      const state = createAdjutantGameState({
        tricks: [
          createCompletedTrick([
            { card: adjutantDesignationCard, playerId: 'other', order: 0 },
          ]),
        ],
      })
      const masked = maskGameStateForPlayer(state, 'me')
      const other = masked.players.find((p) => p.id === 'other')

      for (const card of other?.hand ?? []) {
        expect(card.id.startsWith(MASKED_CARD.ID_PREFIX)).toBe(true)
      }
    })
  })
})

/**
 * サーバーサイド AI へ渡すビュー用。副官の正体だけを伏せ、手札は残す
 * （手札まで潰すと AI が着手を選べなくなる）。
 */
describe('maskAdjutantIdentityForPlayer', () => {
  it('hides another player isAdjutant flag before the reveal', () => {
    const view = maskAdjutantIdentityForPlayer(createAdjutantGameState(), 'me')

    expect(view.players.find((p) => p.id === 'other')?.isAdjutant).toBe(false)
  })

  it('keeps the adjutant own flag visible to themselves', () => {
    const view = maskAdjutantIdentityForPlayer(
      createAdjutantGameState(),
      'other'
    )

    expect(view.players.find((p) => p.id === 'other')?.isAdjutant).toBe(true)
  })

  it('exposes isAdjutant after the reveal', () => {
    const state = createAdjutantGameState({
      tricks: [
        createCompletedTrick([
          { card: adjutantDesignationCard, playerId: 'other', order: 0 },
        ]),
      ],
    })
    const view = maskAdjutantIdentityForPlayer(state, 'me')

    expect(view.players.find((p) => p.id === 'other')?.isAdjutant).toBe(true)
  })

  it('keeps every hand and the hidden pile intact', () => {
    const state = createAdjutantGameState()
    const view = maskAdjutantIdentityForPlayer(state, 'me')

    expect(view.players.map((p) => p.hand.map((c) => c.id))).toEqual(
      state.players.map((p) => p.hand.map((c) => c.id))
    )
    expect(view.hiddenCards).toEqual(state.hiddenCards)
    expect(view.exchangedCards).toEqual(state.exchangedCards)
  })

  it('hides soloNapoleon from everyone but Napoleon before the reveal', () => {
    const state = createAdjutantGameState({ soloNapoleon: true })

    expect(maskAdjutantIdentityForPlayer(state, 'other').soloNapoleon).toBe(
      undefined
    )
    expect(maskAdjutantIdentityForPlayer(state, 'me').soloNapoleon).toBe(true)
  })

  it('does not mutate the original (server side) state', () => {
    const original = createAdjutantGameState({ soloNapoleon: true })
    maskAdjutantIdentityForPlayer(original, 'other')

    expect(original.players.find((p) => p.id === 'other')?.isAdjutant).toBe(
      true
    )
    expect(original.soloNapoleon).toBe(true)
  })
})

describe('restoreAdjutantIdentity', () => {
  it('restores isAdjutant and soloNapoleon from the unmasked state', () => {
    const truth = createAdjutantGameState({ soloNapoleon: true })
    const view = maskAdjutantIdentityForPlayer(truth, 'me')

    const restored = restoreAdjutantIdentity(view, truth)

    expect(restored.players.find((p) => p.id === 'other')?.isAdjutant).toBe(
      true
    )
    expect(restored.soloNapoleon).toBe(true)
  })

  it('keeps the changes the caller made on the masked view', () => {
    const truth = createAdjutantGameState()
    const view = maskAdjutantIdentityForPlayer(truth, 'me')
    const played: GameState = {
      ...view,
      players: view.players.map((player) => ({
        ...player,
        hand: player.hand.slice(1),
      })),
    }

    const restored = restoreAdjutantIdentity(played, truth)

    expect(restored.players.map((p) => p.hand.length)).toEqual([1, 1])
    expect(restored.players.find((p) => p.id === 'other')?.isAdjutant).toBe(
      true
    )
  })

  it('leaves unknown players untouched', () => {
    const truth = createAdjutantGameState()
    const view = maskAdjutantIdentityForPlayer(truth, 'me')
    const withNewcomer: GameState = {
      ...view,
      players: [...view.players, createPlayer('newcomer', [])],
    }

    const restored = restoreAdjutantIdentity(withNewcomer, truth)

    expect(restored.players.find((p) => p.id === 'newcomer')?.isAdjutant).toBe(
      false
    )
  })
})
