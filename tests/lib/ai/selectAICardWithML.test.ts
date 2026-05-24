import { selectAICardWithML } from '@/lib/ai/aiStrategy'
import { GAME_PHASES } from '@/lib/constants'
import { predictBestCard } from '@/lib/ml/mlClient'
import type { Card, GameState, Player, Trick } from '@/types/game'

jest.mock('@/lib/ml/mlClient', () => ({
  predictBestCard: jest.fn(),
}))

const predictMock = predictBestCard as jest.MockedFunction<
  typeof predictBestCard
>

const card = (suit: Card['suit'], rank: Card['rank'], value: number): Card => ({
  id: `${suit}-${rank}`,
  suit,
  rank,
  value,
})

const hand: Card[] = [
  card('hearts', 'A', 14),
  card('hearts', 'K', 13),
  card('spades', '7', 7),
]

const napoleonPlayer: Player = {
  id: 'p1',
  name: 'P1',
  hand,
  isNapoleon: true,
  isAdjutant: false,
  position: 1,
  isAI: true,
}

const otherPlayer: Player = {
  id: 'p2',
  name: 'P2',
  hand: [],
  isNapoleon: false,
  isAdjutant: false,
  position: 2,
  isAI: true,
}

const emptyTrick: Trick = { id: 't', cards: [], completed: false }

const baseState: GameState = {
  id: 'g',
  players: [napoleonPlayer, otherPlayer, otherPlayer, otherPlayer],
  currentTrick: emptyTrick,
  tricks: [],
  currentPlayerIndex: 0,
  phase: GAME_PHASES.PLAYING,
  leadingSuit: undefined,
  trumpSuit: 'hearts',
  hiddenCards: [],
  passedPlayers: [],
  declarationTurn: 0,
  needsRedeal: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const config = {
  strategy: 'heuristic' as const,
  difficulty: 'normal' as const,
}

describe('selectAICardWithML', () => {
  afterEach(() => {
    predictMock.mockReset()
  })

  it('returns the only playable card without calling ML', async () => {
    const single = [card('hearts', 'A', 14)]
    const state = {
      ...baseState,
      players: [
        { ...napoleonPlayer, hand: single },
        otherPlayer,
        otherPlayer,
        otherPlayer,
      ],
    }
    const result = await selectAICardWithML(state, state.players[0], config)
    expect(result?.id).toBe('hearts-A')
    expect(predictMock).not.toHaveBeenCalled()
  })

  it('uses ML pick when confidence >= threshold and card is in playable set', async () => {
    predictMock.mockResolvedValue({
      predictedCardId: 'hearts-K',
      confidence: 0.75,
      topK: [{ cardId: 'hearts-K', confidence: 0.75 }],
    })

    const result = await selectAICardWithML(baseState, napoleonPlayer, config)
    expect(result?.id).toBe('hearts-K')
    expect(predictMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to local strategy when ML confidence is below threshold', async () => {
    predictMock.mockResolvedValue({
      predictedCardId: 'hearts-K',
      confidence: 0.4,
      topK: [{ cardId: 'hearts-K', confidence: 0.4 }],
    })

    const result = await selectAICardWithML(baseState, napoleonPlayer, config)
    // Fallback picked something; just ensure it is from the hand (not the ML pick rejected)
    expect(result).not.toBeNull()
    expect(hand.map((c) => c.id)).toContain(result?.id)
  })

  it('skips ML when predictBestCard returns null (e.g., URL unset, server down)', async () => {
    predictMock.mockResolvedValue(null)
    const result = await selectAICardWithML(baseState, napoleonPlayer, config)
    expect(result).not.toBeNull()
    expect(predictMock).toHaveBeenCalledTimes(1)
  })

  it('rejects ML pick when predicted card is not in playable cards', async () => {
    // Follow-suit: leading hearts → only hearts-* are playable
    const state: GameState = {
      ...baseState,
      currentTrick: {
        id: 't',
        cards: [{ card: card('hearts', '5', 5), playerId: 'pX', order: 0 }],
        leadingSuit: 'hearts',
        completed: false,
      },
      leadingSuit: 'hearts',
    }

    predictMock.mockResolvedValue({
      predictedCardId: 'spades-7', // not playable (must follow hearts)
      confidence: 0.9,
      topK: [
        { cardId: 'spades-7', confidence: 0.9 },
        { cardId: 'hearts-A', confidence: 0.7 }, // fallback candidate
      ],
    })

    const result = await selectAICardWithML(state, napoleonPlayer, config)
    expect(result?.id).toBe('hearts-A') // top-K fallback that is playable
  })

  it('falls back to local strategy when no top-K candidate is both playable and above threshold', async () => {
    const state: GameState = {
      ...baseState,
      currentTrick: {
        id: 't',
        cards: [{ card: card('hearts', '5', 5), playerId: 'pX', order: 0 }],
        leadingSuit: 'hearts',
        completed: false,
      },
      leadingSuit: 'hearts',
    }
    predictMock.mockResolvedValue({
      predictedCardId: 'spades-7',
      confidence: 0.9,
      topK: [
        { cardId: 'spades-7', confidence: 0.9 },
        { cardId: 'clubs-2', confidence: 0.7 }, // not in hand
        { cardId: 'hearts-A', confidence: 0.3 }, // below threshold
      ],
    })
    const result = await selectAICardWithML(state, napoleonPlayer, config)
    // Falls back; should still pick a hearts card (follow-suit)
    expect(result?.suit).toBe('hearts')
  })

  it('sends correct role and trick_number to the ML API', async () => {
    // Return a high-confidence pick so we do not hit the heuristic fallback,
    // which requires extra game state this test does not set up.
    predictMock.mockResolvedValue({
      predictedCardId: 'hearts-A',
      confidence: 0.95,
      topK: [{ cardId: 'hearts-A', confidence: 0.95 }],
    })
    const state: GameState = {
      ...baseState,
      tricks: [
        { ...emptyTrick, id: 't1', completed: true },
        { ...emptyTrick, id: 't2', completed: true },
      ],
    }
    const adjutant: Player = {
      ...napoleonPlayer,
      isNapoleon: false,
      isAdjutant: true,
    }
    await selectAICardWithML(state, adjutant, config)
    expect(predictMock).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'adjutant',
        isNapoleonTeam: true,
        trickNumber: 2,
        trumpSuit: 'hearts',
      })
    )
  })
})
