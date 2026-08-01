/**
 * AI へ渡すゲーム状態から、未公開の副官の正体が隠れていることの不変条件
 *
 * サーバーサイド AI は DB の未マスク状態を受け取るため、対策しないと
 * 「AI だけが人間より多くを知って打つ」状態になる。
 * ルール上は副官指定カードが場に出るまで、ナポレオン本人ですら
 * 誰が副官かを知らない（docs/game-logic/NAPOLEON_RULES.md）。
 *
 * ⚠️ マスクしてよいのは「どのカードを選ぶか」の思考だけ。着手の記帳は
 * 未マスクの真の状態で行う（gameLogic.processAITurn のコメント参照）。
 * ここではその境界も併せて固定する。
 */

import { GAME_PHASES } from '@/lib/constants'
import type { Card, GameState, PlayedCard, Player, Trick } from '@/types/game'

jest.mock('@/lib/ai/gameTricks', () => ({
  selectAICardForCurrentPlayer: jest.fn(),
  processAllAIPhases: jest.fn(),
}))

import {
  processAllAIPhases,
  selectAICardForCurrentPlayer,
} from '@/lib/ai/gameTricks'
import { processAITurn } from '@/lib/gameLogic'

const createCard = (id: string, rank: Card['rank']): Card => ({
  id,
  suit: 'hearts',
  rank,
  value: 10,
})

/** 副官指定カード（ナポレオンが宣言時に指定した公開情報） */
const adjutantDesignationCard = createCard('adjutant-card', 'A')

const createPlayer = (id: string, overrides: Partial<Player> = {}): Player => ({
  id,
  name: `Player ${id}`,
  hand: [createCard(`${id}-c1`, 'K'), createCard(`${id}-c2`, 'Q')],
  isNapoleon: false,
  isAdjutant: false,
  position: 1,
  isAI: true,
  ...overrides,
})

/**
 * 手番: ai-thinker(index 0)。ナポレオンは ai-napoleon、副官は ai-adjutant。
 * 副官指定カードは未公開。
 */
const createPlayingState = (overrides: Partial<GameState> = {}): GameState => ({
  id: 'test-game',
  players: [
    createPlayer('ai-thinker'),
    createPlayer('ai-napoleon', { isNapoleon: true }),
    createPlayer('ai-adjutant', { isAdjutant: true }),
    createPlayer('human', { isAI: false }),
  ],
  phase: GAME_PHASES.PLAYING,
  currentPlayerIndex: 0,
  currentTrick: { id: 'trick-1', cards: [], completed: false },
  tricks: [],
  hiddenCards: [],
  napoleonCard: adjutantDesignationCard,
  soloNapoleon: false,
  trumpSuit: 'spades',
  passedPlayers: [],
  declarationTurn: 0,
  needsRedeal: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const createRevealedTrick = (): Trick => {
  const played: PlayedCard = {
    card: adjutantDesignationCard,
    playerId: 'ai-adjutant',
    order: 0,
  }
  return {
    id: 'trick-revealed',
    cards: [played],
    completed: true,
    winnerPlayerId: 'ai-adjutant',
  }
}

/** AI の思考（カード選択）へ渡された状態 */
const stateGivenToAI = (): GameState =>
  (selectAICardForCurrentPlayer as jest.Mock).mock.calls[0][0] as GameState

beforeEach(() => {
  jest.clearAllMocks()
  // AI は手番プレイヤーの1枚目を選ぶ（どのカードかはここでの関心事ではない）
  ;(selectAICardForCurrentPlayer as jest.Mock).mockImplementation(
    async (state: GameState) => state.players[state.currentPlayerIndex].hand[0]
  )
  ;(processAllAIPhases as jest.Mock).mockImplementation(
    async (state: GameState) => state
  )
})

describe('processAITurn - adjutant identity hidden from AI', () => {
  describe('before the adjutant designation card is played', () => {
    it('does not expose another player isAdjutant flag to the AI', async () => {
      await processAITurn(createPlayingState())

      expect(
        stateGivenToAI().players.find((p) => p.id === 'ai-adjutant')?.isAdjutant
      ).toBe(false)
    })

    it('does not leak the adjutant flag anywhere in the AI view', async () => {
      await processAITurn(createPlayingState())

      expect(JSON.stringify(stateGivenToAI())).not.toContain(
        '"isAdjutant":true'
      )
    })

    it('hides the adjutant from the Napoleon AI as well', async () => {
      await processAITurn(
        createPlayingState({
          // ナポレオン本人（index 1）の手番
          currentPlayerIndex: 1,
        })
      )

      expect(
        stateGivenToAI().players.find((p) => p.id === 'ai-adjutant')?.isAdjutant
      ).toBe(false)
    })

    it('keeps the adjutant AI own flag visible to itself', async () => {
      await processAITurn(
        createPlayingState({
          // 副官本人（index 2）の手番
          currentPlayerIndex: 2,
        })
      )

      expect(
        stateGivenToAI().players.find((p) => p.id === 'ai-adjutant')?.isAdjutant
      ).toBe(true)
    })

    it('hides soloNapoleon from a non-Napoleon AI', async () => {
      await processAITurn(createPlayingState({ soloNapoleon: true }))

      expect(stateGivenToAI().soloNapoleon).toBeUndefined()
    })

    it('keeps soloNapoleon visible to the Napoleon AI', async () => {
      await processAITurn(
        createPlayingState({ soloNapoleon: true, currentPlayerIndex: 1 })
      )

      expect(stateGivenToAI().soloNapoleon).toBe(true)
    })
  })

  describe('after the adjutant is revealed', () => {
    it('exposes isAdjutant once the designation card is in a completed trick', async () => {
      await processAITurn(
        createPlayingState({ tricks: [createRevealedTrick()] })
      )

      expect(
        stateGivenToAI().players.find((p) => p.id === 'ai-adjutant')?.isAdjutant
      ).toBe(true)
    })

    it('exposes soloNapoleon once revealed', async () => {
      await processAITurn(
        createPlayingState({
          soloNapoleon: true,
          tricks: [createRevealedTrick()],
        })
      )

      expect(stateGivenToAI().soloNapoleon).toBe(true)
    })
  })

  describe('does not over-mask', () => {
    it('keeps every hand intact so the AI can still choose a card', async () => {
      const original = createPlayingState()
      await processAITurn(original)

      expect(
        stateGivenToAI().players.map((p) => p.hand.map((c) => c.id))
      ).toEqual(original.players.map((p) => p.hand.map((c) => c.id)))
    })

    it('keeps the public isNapoleon flag untouched', async () => {
      await processAITurn(createPlayingState())

      expect(
        stateGivenToAI().players.find((p) => p.id === 'ai-napoleon')?.isNapoleon
      ).toBe(true)
    })

    it('leaves the phases before PLAYING unmasked (the adjutant is decided there)', async () => {
      const state = createPlayingState({ phase: GAME_PHASES.ADJUTANT })
      await processAITurn(state)

      expect(processAllAIPhases).toHaveBeenCalledWith(state)
      expect(selectAICardForCurrentPlayer).not.toHaveBeenCalled()
    })
  })

  describe('the move itself is applied to the unmasked state', () => {
    it('keeps isAdjutant true on the state processAITurn returns', async () => {
      const result = await processAITurn(createPlayingState())

      expect(
        result.players.find((p) => p.id === 'ai-adjutant')?.isAdjutant
      ).toBe(true)
    })

    it('keeps soloNapoleon on the state processAITurn returns', async () => {
      const result = await processAITurn(
        createPlayingState({ soloNapoleon: true })
      )

      expect(result.soloNapoleon).toBe(true)
    })

    it('applies the card the AI chose', async () => {
      const result = await processAITurn(createPlayingState())

      expect(result.currentTrick.cards).toHaveLength(1)
      expect(result.currentTrick.cards[0].card.id).toBe('ai-thinker-c1')
      expect(result.players[0].hand.map((c) => c.id)).toEqual(['ai-thinker-c2'])
    })

    it('does not mutate the original (server side) state', async () => {
      const original = createPlayingState()
      await processAITurn(original)

      expect(
        original.players.find((p) => p.id === 'ai-adjutant')?.isAdjutant
      ).toBe(true)
      expect(original.soloNapoleon).toBe(false)
      expect(original.currentTrick.cards).toHaveLength(0)
    })
  })

  describe('human turn', () => {
    it('does not run the AI at all when the current player is human', async () => {
      const state = createPlayingState({ currentPlayerIndex: 3 })
      const result = await processAITurn(state)

      expect(selectAICardForCurrentPlayer).not.toHaveBeenCalled()
      expect(result).toBe(state)
    })
  })
})
