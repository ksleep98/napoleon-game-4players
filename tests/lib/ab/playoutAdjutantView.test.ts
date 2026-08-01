/**
 * A/B ハーネスが本番と同じ「AI 視点ビュー」で AI を評価することの不変条件
 *
 * ハーネスは `selectAICard` を直接呼ぶため、本番の
 * `gameLogic.processAITurn`（ここでマスクを掛けている）を経由しない。
 * ここが外れるとハーネスだけが「副官を知ったままの AI」を測り続け、
 * 強さ比較が本番とズレる。
 */

import { parseVariantSpec } from '@/lib/ab/cli'
import {
  AB_DEFAULTS,
  SETUP_DECLARATION_POLICIES,
  STRATEGY_NAMES,
  VARIANT_ROLES,
} from '@/lib/ab/constants'
import type { GameSetup } from '@/lib/ab/types'
import type { Card, GameState, Player } from '@/types/game'
import { isAdjutantIdentityPublic } from '@/utils/gameUtils'

jest.mock('@/lib/ai/aiStrategy', () => ({
  selectAICard: jest.fn(),
}))

import { playoutGame, resolveSeatAssignments } from '@/lib/ab/playout'
import { setupGame } from '@/lib/ab/setup'
import { selectAICard } from '@/lib/ai/aiStrategy'

const HEURISTIC = parseVariantSpec(STRATEGY_NAMES.HEURISTIC)

/** AI が観測した局面（= selectAICard に渡された state と手番プレイヤー） */
interface Observation {
  state: GameState
  viewer: Player
}

const buildSetup = (): GameSetup => {
  const setup = setupGame(
    42,
    SETUP_DECLARATION_POLICIES.HEURISTIC,
    AB_DEFAULTS.MAX_REDEALS
  )
  if (!setup) throw new Error('setupGame returned null')
  return setup
}

/**
 * selectAICard をスタブし、渡された局面を記録しつつ決定論的に着手する。
 * 戦略そのものはここでの関心事ではない（観測される情報だけを見る）。
 */
const captureObservations = (): Observation[] => {
  const observations: Observation[] = []
  ;(selectAICard as jest.Mock).mockImplementation(
    (state: GameState, player: Player): Card | null => {
      observations.push({ state, viewer: player })
      return player.hand[0] ?? null
    }
  )
  return observations
}

const runPlayout = (): { setup: GameSetup; observations: Observation[] } => {
  const setup = buildSetup()
  const observations = captureObservations()
  const assignments = resolveSeatAssignments(
    setup,
    VARIANT_ROLES.NAPOLEON_TEAM,
    HEURISTIC,
    HEURISTIC
  )

  playoutGame(setup, assignments, 42)

  return { setup, observations }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('playoutGame - AI view matches production', () => {
  it('builds a setup that actually has an adjutant (otherwise this suite is vacuous)', () => {
    const setup = buildSetup()

    expect(setup.adjutantPlayerId).toBeDefined()
    expect(
      setup.state.players.filter((p) => p.isAdjutant).map((p) => p.id)
    ).toEqual([setup.adjutantPlayerId])
    expect(setup.state.napoleonCard).toBeDefined()
  })

  it('never shows another player isAdjutant before the reveal', () => {
    const { observations } = runPlayout()

    expect(observations.length).toBeGreaterThan(0)

    for (const { state, viewer } of observations) {
      if (isAdjutantIdentityPublic(state)) continue

      const leaked = state.players.filter(
        (p) => p.isAdjutant && p.id !== viewer.id
      )
      expect(leaked).toEqual([])
    }
  })

  it('still shows the adjutant its own flag', () => {
    const { setup, observations } = runPlayout()

    const selfViews = observations.filter(
      ({ viewer }) => viewer.id === setup.adjutantPlayerId
    )

    expect(selfViews.length).toBeGreaterThan(0)
    for (const { state, viewer } of selfViews) {
      expect(state.players.find((p) => p.id === viewer.id)?.isAdjutant).toBe(
        true
      )
    }
  })

  it('exposes the adjutant again once the designation card is played', () => {
    const { setup, observations } = runPlayout()

    const revealedViews = observations.filter(({ state }) =>
      isAdjutantIdentityPublic(state)
    )

    for (const { state } of revealedViews) {
      expect(
        state.players.find((p) => p.id === setup.adjutantPlayerId)?.isAdjutant
      ).toBe(true)
    }
  })

  it('does not carry the mask into the harness own state', () => {
    const { setup, observations } = runPlayout()

    // ループが保持する state は真値のまま。マスク済みビューを次周へ持ち越すと
    // 副官フラグが消えたまま試合が進んでしまう。
    // 観測列の後半でも「副官席が自分の isAdjutant を見失っていない」ことで確認する。
    const lastSelfView = [...observations]
      .reverse()
      .find(({ viewer }) => viewer.id === setup.adjutantPlayerId)

    expect(lastSelfView).toBeDefined()
    expect(
      lastSelfView?.state.players.find((p) => p.id === setup.adjutantPlayerId)
        ?.isAdjutant
    ).toBe(true)

    // 元の setup も破壊されていない
    expect(
      setup.state.players.find((p) => p.id === setup.adjutantPlayerId)
        ?.isAdjutant
    ).toBe(true)
  })

  it('keeps every hand intact so the AI can still choose a card', () => {
    const { observations } = runPlayout()

    for (const { state, viewer } of observations) {
      expect(state.players.find((p) => p.id === viewer.id)?.hand.length).toBe(
        viewer.hand.length
      )
      expect(viewer.hand.length).toBeGreaterThan(0)
    }
  })
})
