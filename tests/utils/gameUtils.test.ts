import { GAME_PHASES } from '@/lib/constants'
import type { Card, GameState, PlayedCard } from '@/types/game'
import {
  checkAdjutantRevealed,
  isAdjutantIdentityPublic,
  showsAdjutantBadge,
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

describe('showsAdjutantBadge', () => {
  const napoleon = { isNapoleon: true, isAdjutant: false }
  const realAdjutant = { isNapoleon: false, isAdjutant: true }
  const citizen = { isNapoleon: false, isAdjutant: false }

  describe('normal game (an adjutant really exists)', () => {
    it('hides the adjutant from other players until revealed', () => {
      expect(
        showsAdjutantBadge({
          player: realAdjutant,
          soloNapoleon: false,
          isAdjutantRevealed: false,
        })
      ).toBe(false)
    })

    it('always shows the adjutant their own badge', () => {
      expect(
        showsAdjutantBadge({
          player: realAdjutant,
          soloNapoleon: false,
          isAdjutantRevealed: false,
          isCurrentUser: true,
        })
      ).toBe(true)
    })

    it('shows the adjutant to everyone once revealed', () => {
      expect(
        showsAdjutantBadge({
          player: realAdjutant,
          soloNapoleon: false,
          isAdjutantRevealed: true,
        })
      ).toBe(true)
    })

    it('never marks Napoleon or a citizen as adjutant', () => {
      for (const player of [napoleon, citizen]) {
        expect(
          showsAdjutantBadge({
            player,
            soloNapoleon: false,
            isAdjutantRevealed: true,
            isCurrentUser: true,
          })
        ).toBe(false)
      }
    })
  })

  describe('solo napoleon (adjutant card was buried)', () => {
    it('shows no adjutant badge before the card is revealed', () => {
      expect(
        showsAdjutantBadge({
          player: napoleon,
          soloNapoleon: true,
          isAdjutantRevealed: false,
        })
      ).toBe(false)
    })

    it('does not let Napoleon see it early just by being the viewer', () => {
      // 公開前にソロだと分かること自体が情報になるため、
      // isCurrentUser では早出ししない
      expect(
        showsAdjutantBadge({
          player: napoleon,
          soloNapoleon: true,
          isAdjutantRevealed: false,
          isCurrentUser: true,
        })
      ).toBe(false)
    })

    it('marks Napoleon as the adjutant once revealed', () => {
      expect(
        showsAdjutantBadge({
          player: napoleon,
          soloNapoleon: true,
          isAdjutantRevealed: true,
        })
      ).toBe(true)
    })

    it('never marks a citizen as adjutant in a solo game', () => {
      expect(
        showsAdjutantBadge({
          player: citizen,
          soloNapoleon: true,
          isAdjutantRevealed: true,
        })
      ).toBe(false)
    })
  })
})
