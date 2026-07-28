/**
 * A/B セルフプレイ用のゲームセットアップ（配牌 → ナポレオン宣言 → 副官 → 交換）。
 *
 * ⚠️ なぜ `@/lib/gameLogic` をそのまま使わないか:
 *   `gameLogic.ts` は `@/lib/ai/gameTricks` を静的 import しており、その先で
 *   `@/app/actions/mlDataCollectionActions` → `@/lib/supabase/server` に到達する。
 *   `supabase/server.ts` は `NEXT_PUBLIC_SUPABASE_URL` 未設定時に import 時点で
 *   throw するため、環境変数なしでは gameLogic を import できない。
 *   本ハーネスは「ネットワーク・Supabase・ML API に一切依存しない」ことを
 *   要件としているため、Supabase に触れない下位モジュール
 *   (`napoleonRules` / `cardUtils` / `ai/napoleon` / `ai/napoleonMCTS`) を直接使い、
 *   gameLogic の薄いラッパ相当（declareNapoleon / setAdjutant / exchangeCards）
 *   だけをここで等価に再実装している。
 *
 * セットアップはシードごとに 1 回だけ実行し、その結果を両バリアントに
 * 同一の初期局面として渡す（common random numbers）。これにより
 * 「配牌・宣言・副官・交換」が完全に一致した状態でプレイ方策だけを比較できる。
 */

import { napoleonAIStrategy } from '@/lib/ai/napoleon'
import {
  NAPOLEON_MCTS_PRESETS,
  napoleonAIStrategyWithMCTS,
} from '@/lib/ai/napoleonMCTS'
import { GAME_CONFIG, GAME_PHASES } from '@/lib/constants'
import {
  advanceNapoleonPhase,
  canDeclareNapoleon,
  findAdjutant,
  getNextDeclarationPlayer,
  isAdjutantCardBuried,
  isValidNapoleonDeclaration,
  shouldRedeal,
} from '@/lib/napoleonRules'
import { setSeed } from '@/lib/utils/rng'
import type { Card, GameState, NapoleonDeclaration, Player } from '@/types/game'
import { dealCards } from '@/utils/cardUtils'
import {
  AB_DEFAULTS,
  DETERMINISTIC_TIME_LIMIT_MS,
  HARNESS_GAME_ID_PREFIX,
  HARNESS_PLAYER_ID_PREFIX,
  HARNESS_PLAYER_NAME_PREFIX,
  SETUP_DECLARATION_POLICIES,
  type SetupDeclarationPolicy,
} from './constants'
import type { GameSetup } from './types'

/** ナポレオン宣言 MCTS の設定（実時間制限を外して決定論化） */
const SETUP_MCTS_CONFIG = {
  ...NAPOLEON_MCTS_PRESETS.fast,
  timeLimit: DETERMINISTIC_TIME_LIMIT_MS,
}

/** 決定論的な 4 人の AI プレイヤーを生成 */
export function createHarnessPlayers(): Player[] {
  const players: Player[] = []
  for (let i = 0; i < GAME_CONFIG.PLAYERS_COUNT; i++) {
    players.push({
      id: `${HARNESS_PLAYER_ID_PREFIX}${i + 1}`,
      name: `${HARNESS_PLAYER_NAME_PREFIX}${i + 1}`,
      hand: [],
      isNapoleon: false,
      isAdjutant: false,
      position: i + 1,
      isAI: true,
    })
  }
  return players
}

/** 空のトリックを生成（ID は決定論的） */
function createTrick(index: number): GameState['currentTrick'] {
  return {
    id: `trick-${index}`,
    cards: [],
    completed: false,
  }
}

/** 配牌済みの初期状態を生成 */
function createDealtState(seed: number, dealIndex: number): GameState {
  const { players, hiddenCards } = dealCards(createHarnessPlayers())

  return {
    id: `${HARNESS_GAME_ID_PREFIX}${seed}_${dealIndex}`,
    players,
    currentTrick: createTrick(1),
    tricks: [],
    currentPlayerIndex: 0,
    phase: GAME_PHASES.NAPOLEON,
    hiddenCards,
    passedPlayers: [],
    declarationTurn: 0,
    needsRedeal: false,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }
}

/** gameLogic.declareNapoleon 相当（Supabase 非依存の再実装） */
function applyDeclaration(
  state: GameState,
  declaration: NapoleonDeclaration
): GameState {
  const players = state.players.map((player) => ({
    ...player,
    isNapoleon: player.id === declaration.playerId,
  }))

  return advanceNapoleonPhase({
    ...state,
    players,
    napoleonDeclaration: declaration,
    napoleonCard: declaration.adjutantCard,
  })
}

/** gameLogic.passNapoleonDeclaration 相当 */
function applyPass(state: GameState, playerId: string): GameState {
  const passed = {
    ...state,
    passedPlayers: [...state.passedPlayers, playerId],
  }

  if (shouldRedeal(passed)) {
    return { ...passed, needsRedeal: true }
  }

  return advanceNapoleonPhase(passed)
}

/** gameLogic.setAdjutant 相当（副官確定 + 隠しカードをナポレオンへ） */
function applyAdjutant(state: GameState, adjutantCard: Card): GameState {
  // gameLogic.setAdjutant と同じく、埋め札は手札へ移す前に判定する
  const soloNapoleon = isAdjutantCardBuried(state, adjutantCard)
  const adjutantPlayer = findAdjutant(state, adjutantCard)

  const players = state.players.map((player) => {
    const withRole = {
      ...player,
      isAdjutant: adjutantPlayer !== null && player.id === adjutantPlayer.id,
    }

    if (!withRole.isNapoleon) return withRole

    const hiddenWithFlag = state.hiddenCards.map((card) => ({
      ...card,
      wasHidden: true,
    }))
    return { ...withRole, hand: [...withRole.hand, ...hiddenWithFlag] }
  })

  return {
    ...state,
    players,
    phase: GAME_PHASES.EXCHANGE,
    napoleonCard: adjutantCard,
    soloNapoleon,
  }
}

/**
 * 捨てるカードを選択する（gameTricks.selectCardsToDiscard と同じ方針）。
 * value 昇順で下位 4 枚。同値の場合は元の並び順を維持して決定論的にする。
 */
export function selectCardsToDiscard(hand: Card[]): Card[] {
  return [...hand]
    .map((card, index) => ({ card, index }))
    .sort((a, b) =>
      a.card.value !== b.card.value
        ? a.card.value - b.card.value
        : a.index - b.index
    )
    .slice(0, GAME_CONFIG.HIDDEN_CARDS)
    .map((entry) => entry.card)
}

/** gameLogic.exchangeCards 相当 */
function applyExchange(state: GameState, napoleonId: string): GameState {
  const napoleon = state.players.find((p) => p.id === napoleonId)
  if (!napoleon) {
    throw new Error(`Napoleon ${napoleonId} not found`)
  }

  const discards = selectCardsToDiscard(napoleon.hand)
  const discardIds = new Set(discards.map((card) => card.id))
  const newHand = napoleon.hand.filter((card) => !discardIds.has(card.id))

  if (newHand.length !== GAME_CONFIG.CARDS_PER_PLAYER) {
    throw new Error(
      `Expected ${GAME_CONFIG.CARDS_PER_PLAYER} cards after exchange, got ${newHand.length}`
    )
  }

  const players = state.players.map((player) =>
    player.id === napoleonId ? { ...player, hand: newHand } : player
  )

  return {
    ...state,
    players,
    exchangedCards: discards,
    phase: GAME_PHASES.PLAYING,
    currentPlayerIndex: state.players.findIndex((p) => p.id === napoleonId),
  }
}

/** 宣言方策を適用 */
function decideDeclaration(
  state: GameState,
  playerId: string,
  policy: SetupDeclarationPolicy
): { shouldDeclare: boolean; declaration?: NapoleonDeclaration } {
  if (policy === SETUP_DECLARATION_POLICIES.MCTS) {
    return napoleonAIStrategyWithMCTS(state, playerId, SETUP_MCTS_CONFIG)
  }
  return napoleonAIStrategy(state, playerId)
}

/** 宣言フェーズを最後まで進める */
function runDeclarationPhase(
  initialState: GameState,
  policy: SetupDeclarationPolicy
): GameState {
  let state = initialState
  let iterations = 0

  while (
    state.phase === GAME_PHASES.NAPOLEON &&
    !state.needsRedeal &&
    iterations < AB_DEFAULTS.MAX_DECLARATION_ITERATIONS
  ) {
    iterations += 1

    const nextPlayer = getNextDeclarationPlayer(state)
    if (!nextPlayer || !canDeclareNapoleon(state, nextPlayer.id)) {
      state = advanceNapoleonPhase(state)
      continue
    }

    const strategy = decideDeclaration(state, nextPlayer.id, policy)
    const declaration = strategy.declaration
      ? { ...strategy.declaration, playerId: nextPlayer.id }
      : undefined

    if (
      strategy.shouldDeclare &&
      declaration &&
      isValidNapoleonDeclaration(declaration, state.napoleonDeclaration)
    ) {
      state = applyDeclaration(state, declaration)
    } else {
      state = applyPass(state, nextPlayer.id)
    }
  }

  return state
}

/**
 * シードから 1 局分のセットアップを作る。
 * 全員パスで配り直しになった場合はシードを進めて再試行し、
 * 上限を超えたら null を返す（呼び出し側でそのシードをスキップ）。
 */
export function setupGame(
  seed: number,
  policy: SetupDeclarationPolicy,
  maxRedeals: number
): GameSetup | null {
  let redeals = 0

  for (let attempt = 0; attempt <= maxRedeals; attempt++) {
    // 配り直しごとにシードをずらすことで、再現性を保ったまま別の配牌になる
    setSeed(seed + attempt)

    const dealt = createDealtState(seed, attempt)
    const declared = runDeclarationPhase(dealt, policy)

    if (declared.needsRedeal || !declared.napoleonDeclaration) {
      redeals += 1
      continue
    }

    const declaration = declared.napoleonDeclaration
    const adjutantCard = declaration.adjutantCard
    if (!adjutantCard) {
      redeals += 1
      continue
    }

    const withAdjutant = applyAdjutant(declared, adjutantCard)
    const exchanged = applyExchange(withAdjutant, declaration.playerId)

    const napoleon = exchanged.players.find((p) => p.isNapoleon)
    if (!napoleon) {
      redeals += 1
      continue
    }
    const adjutant = exchanged.players.find((p) => p.isAdjutant)

    return {
      // 切り札を明示的に設定する。
      // determineWinner (gameLogic) は `trumpSuit || napoleonDeclaration.suit`
      // とフォールバックするが、gameSimulator.completeTrick と
      // strategicCardEvaluator は `gameState.trumpSuit` を直接読むため、
      // ここで宣言スートを反映しないと切り札なしの別ゲームになってしまう。
      state: {
        ...exchanged,
        trumpSuit: declaration.suit,
        leadingSuit: undefined,
        currentTrick: createTrick(1),
      },
      redeals,
      napoleonPlayerId: napoleon.id,
      adjutantPlayerId: adjutant?.id,
      targetFaceCards: declaration.targetTricks,
      trumpSuit: declaration.suit,
    }
  }

  return null
}
