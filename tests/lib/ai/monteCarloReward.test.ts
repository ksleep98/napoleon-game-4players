/**
 * MCTS 報酬のマージン化に関するテスト。
 *
 * 検証したい不変条件:
 *   1. `napoleonReward` は常に [0, 1]（UCB1 の exploitation 項の前提）
 *   2. 獲得絵札数に対して単調増加
 *   3. 「どんな勝ちも、どんな負けより厳密に良い」（勝ち >= 0.5 > 負け）
 *   4. 連合軍側はゼロサム（1 - x）
 *   5. 探索木の全ノードで exploitation = totalReward / visits ∈ [0, 1]
 */

import { SETUP_DECLARATION_POLICIES } from '@/lib/ab/constants'
import { setupGame } from '@/lib/ab/setup'
import { getGameResult, napoleonReward } from '@/lib/ai/gameSimulator'
import {
  buildSearchTree,
  calculateUCB1,
  MCTS_PRESETS,
  type MCTSConfig,
  type MCTSNode,
  rewardForPlayer,
} from '@/lib/ai/monteCarloAI'
import { NAPOLEON_RULES } from '@/lib/constants'
import { resetToMathRandom, setSeed } from '@/lib/utils/rng'
import type { GameState, Player } from '@/types/game'

const TOTAL = NAPOLEON_RULES.TOTAL_FACE_CARDS
const DEFAULT_TARGET = NAPOLEON_RULES.TARGET_FACE_CARDS

/** 実際に宣言されうる目標値の範囲（最低宣言 〜 全絵札） */
const TARGETS = Array.from(
  { length: TOTAL - DEFAULT_TARGET + 1 },
  (_, i) => DEFAULT_TARGET + i
)

/** 0 枚 〜 全絵札 */
const FACE_COUNTS = Array.from({ length: TOTAL + 1 }, (_, i) => i)

function createPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'P1',
    hand: [],
    isAI: true,
    isNapoleon: false,
    isAdjutant: false,
    position: 1,
    ...overrides,
  }
}

/** 探索木を再帰的に走査する */
function walk(node: MCTSNode, visit: (node: MCTSNode) => void): void {
  visit(node)
  for (const child of node.children) walk(child, visit)
}

describe('napoleonReward', () => {
  it('stays within [0, 1] for every reachable (faceCardsWon, target) pair', () => {
    for (const target of TARGETS) {
      for (const won of FACE_COUNTS) {
        const reward = napoleonReward(won, target)
        expect(Number.isFinite(reward)).toBe(true)
        expect(reward).toBeGreaterThanOrEqual(0)
        expect(reward).toBeLessThanOrEqual(1)
      }
    }
  })

  it('returns 0 when Napoleon takes no face card at all', () => {
    for (const target of TARGETS) {
      expect(napoleonReward(0, target)).toBe(0)
    }
  })

  it('returns exactly 0.5 when Napoleon meets the declaration exactly', () => {
    for (const target of TARGETS) {
      expect(napoleonReward(target, target)).toBeCloseTo(0.5, 12)
    }
  })

  it('returns 1 for a clean sweep of every face card', () => {
    expect(napoleonReward(TOTAL, DEFAULT_TARGET)).toBeCloseTo(1, 12)
  })

  it('is strictly increasing in face cards won', () => {
    for (const target of TARGETS) {
      for (let won = 0; won < TOTAL; won++) {
        expect(napoleonReward(won + 1, target)).toBeGreaterThan(
          napoleonReward(won, target)
        )
      }
    }
  })

  it('ranks every win strictly above every loss', () => {
    for (const target of TARGETS) {
      const losses = FACE_COUNTS.filter((won) => won < target).map((won) =>
        napoleonReward(won, target)
      )
      const wins = FACE_COUNTS.filter((won) => won >= target).map((won) =>
        napoleonReward(won, target)
      )

      for (const loss of losses) expect(loss).toBeLessThan(0.5)
      for (const win of wins) expect(win).toBeGreaterThanOrEqual(0.5)
      if (losses.length > 0 && wins.length > 0) {
        expect(Math.max(...losses)).toBeLessThan(Math.min(...wins))
      }
    }
  })

  it('clamps values outside the reachable range instead of leaving [0, 1]', () => {
    // 目標が全絵札のときは上振れの余地がない（分母 0 の保護）
    expect(napoleonReward(TOTAL, TOTAL)).toBeCloseTo(0.5, 12)
    // 想定外の入力でも [0, 1] を割らない
    expect(napoleonReward(TOTAL + 5, DEFAULT_TARGET)).toBe(1)
    expect(napoleonReward(-3, DEFAULT_TARGET)).toBe(0)
    expect(napoleonReward(1, 0)).toBeGreaterThanOrEqual(0.5)
  })
})

describe('rewardForPlayer', () => {
  it('is zero-sum between the Napoleon team and the allied team', () => {
    const napoleon = createPlayer({ id: 'nap', isNapoleon: true })
    const adjutant = createPlayer({ id: 'adj', isAdjutant: true })
    const citizen = createPlayer({ id: 'cit' })

    for (const won of FACE_COUNTS) {
      const reward = napoleonReward(won, DEFAULT_TARGET)
      expect(rewardForPlayer(napoleon, reward)).toBeCloseTo(reward, 12)
      expect(rewardForPlayer(adjutant, reward)).toBeCloseTo(reward, 12)
      expect(rewardForPlayer(citizen, reward)).toBeCloseTo(1 - reward, 12)
      expect(
        rewardForPlayer(napoleon, reward) + rewardForPlayer(citizen, reward)
      ).toBeCloseTo(1, 12)
    }
  })
})

describe('getGameResult', () => {
  it('exposes a napoleonReward consistent with the standalone function', () => {
    const setup = setupGame(4242, SETUP_DECLARATION_POLICIES.HEURISTIC, 20)
    expect(setup).not.toBeNull()
    const state = (setup as NonNullable<typeof setup>).state as GameState

    const result = getGameResult(state)
    expect(result.napoleonReward).toBeCloseTo(
      napoleonReward(result.napoleonTricksWon, result.targetTricks),
      12
    )
    expect(result.napoleonReward).toBeGreaterThanOrEqual(0)
    expect(result.napoleonReward).toBeLessThanOrEqual(1)
    // まだ 1 トリックも取っていない初期局面なので負け側の下限
    expect(result.napoleonWon).toBe(false)
    expect(result.napoleonReward).toBe(0)
  })
})

describe('buildSearchTree', () => {
  const config: MCTSConfig = {
    ...MCTS_PRESETS.fast,
    simulationCount: 60,
    determinizationCount: 1,
  }

  afterEach(() => {
    resetToMathRandom()
  })

  it('keeps the UCB1 exploitation term inside [0, 1] on every node', () => {
    const setup = setupGame(4242, SETUP_DECLARATION_POLICIES.HEURISTIC, 20)
    expect(setup).not.toBeNull()
    const { state } = setup as NonNullable<typeof setup>

    setSeed(4242)
    const player = state.players[state.currentPlayerIndex]
    const root = buildSearchTree(
      { ...state, trumpSuit: state.trumpSuit },
      player,
      config
    )

    let nodes = 0
    walk(root, (node) => {
      nodes += 1
      expect(node.totalReward).toBeGreaterThanOrEqual(0)
      expect(node.totalReward).toBeLessThanOrEqual(node.visits)
      if (node.visits > 0) {
        const exploitation = node.totalReward / node.visits
        expect(exploitation).toBeGreaterThanOrEqual(0)
        expect(exploitation).toBeLessThanOrEqual(1)
      }
    })

    expect(nodes).toBeGreaterThan(1)
    expect(root.visits).toBeGreaterThan(0)
  })

  it('produces a non-degenerate exploitation gradient across root children', () => {
    const setup = setupGame(4242, SETUP_DECLARATION_POLICIES.HEURISTIC, 20)
    expect(setup).not.toBeNull()
    const { state } = setup as NonNullable<typeof setup>

    setSeed(4242)
    const player = state.players[state.currentPlayerIndex]
    const root = buildSearchTree(
      { ...state, trumpSuit: state.trumpSuit },
      player,
      config
    )

    const visited = root.children.filter((child) => child.visits > 0)
    expect(visited.length).toBeGreaterThan(1)

    // 勝敗の 0/1 報酬では全兄弟が同じ値に張り付いて UCB1 の活用項が死ぬ。
    // マージン報酬なら少なくとも 2 種類以上の値が現れる。
    const exploitations = visited.map(
      (child) => child.totalReward / child.visits
    )
    expect(
      new Set(exploitations.map((v) => v.toFixed(9))).size
    ).toBeGreaterThan(1)
    // 整数カウントではなく実数の報酬が積まれていること
    expect(visited.some((child) => !Number.isInteger(child.totalReward))).toBe(
      true
    )
  })

  it('calculateUCB1 adds exploration on top of a [0, 1] exploitation term', () => {
    const node: MCTSNode = {
      gameState: {} as GameState,
      playedCard: null,
      visits: 4,
      totalReward: 1,
      parent: null,
      children: [],
      untriedActions: [],
    }

    const c = Math.sqrt(2)
    const expected = 0.25 + c * Math.sqrt(Math.log(16) / 4)
    expect(calculateUCB1(node, 16, c)).toBeCloseTo(expected, 12)
    expect(calculateUCB1({ ...node, visits: 0 }, 16, c)).toBe(
      Number.POSITIVE_INFINITY
    )
  })
})
