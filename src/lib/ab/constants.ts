/**
 * A/B セルフプレイ計測ハーネスの定数定義。
 *
 * プロジェクト規約に従い、文字列リテラルの直書きを避けてここから参照する。
 */

import type { AIStrategyType } from '@/lib/ai/aiStrategy'
import { MCTS_PRESETS } from '@/lib/ai/monteCarloAI'
import { NAPOLEON_RULES } from '@/lib/constants'

/** 変更対象（variant を適用する対象）のロール */
export const VARIANT_ROLES = {
  NAPOLEON_TEAM: 'napoleon-team',
  NAPOLEON: 'napoleon',
  ADJUTANT: 'adjutant',
  ALLIED: 'allied',
  ALL: 'all',
} as const

export type VariantRole = (typeof VARIANT_ROLES)[keyof typeof VARIANT_ROLES]

export const VARIANT_ROLE_VALUES: readonly VariantRole[] =
  Object.values(VARIANT_ROLES)

/** AI 戦略名（AIStrategyType と一致させる） */
export const STRATEGY_NAMES = {
  HEURISTIC: 'heuristic',
  MCTS: 'mcts',
  HYBRID: 'hybrid',
} as const

export const STRATEGY_NAME_VALUES: readonly AIStrategyType[] =
  Object.values(STRATEGY_NAMES)

/** MCTS プリセット名 */
export const MCTS_PRESET_NAMES = {
  FAST: 'fast',
  NORMAL: 'normal',
  STRONG: 'strong',
} as const

export type MCTSPresetName =
  (typeof MCTS_PRESET_NAMES)[keyof typeof MCTS_PRESET_NAMES]

export const MCTS_PRESET_NAME_VALUES: readonly MCTSPresetName[] =
  Object.values(MCTS_PRESET_NAMES)

/** プリセット名 → MCTS_PRESETS の対応 */
export const MCTS_PRESET_BY_NAME = {
  [MCTS_PRESET_NAMES.FAST]: MCTS_PRESETS.fast,
  [MCTS_PRESET_NAMES.NORMAL]: MCTS_PRESETS.normal,
  [MCTS_PRESET_NAMES.STRONG]: MCTS_PRESETS.strong,
} as const

/** 戦略名 → 難易度ラベル（selectAICard は difficulty を参照しないが型上必須） */
export const DIFFICULTY_BY_STRATEGY = {
  [STRATEGY_NAMES.HEURISTIC]: 'easy',
  [STRATEGY_NAMES.HYBRID]: 'normal',
  [STRATEGY_NAMES.MCTS]: 'hard',
} as const

/** ナポレオン宣言（セットアップ）で使う方策 */
export const SETUP_DECLARATION_POLICIES = {
  HEURISTIC: 'heuristic',
  MCTS: 'mcts',
} as const

export type SetupDeclarationPolicy =
  (typeof SETUP_DECLARATION_POLICIES)[keyof typeof SETUP_DECLARATION_POLICIES]

export const SETUP_DECLARATION_POLICY_VALUES: readonly SetupDeclarationPolicy[] =
  Object.values(SETUP_DECLARATION_POLICIES)

/**
 * 決定論を保つための MCTS 時間制限（ミリ秒）。
 *
 * monteCarloAI / napoleonMCTS は `Date.now() - start < timeLimit` で
 * 打ち切るため、実時間制限が効くとマシン負荷によって探索回数が変わり
 * 結果が再現しない。そこで既定では実質無限の時間制限を与え、
 * `simulationCount` 側で必ず打ち切るようにして決定論性を確保する。
 * 実時間制限つきの挙動を測りたい場合は CLI の `--time-limit` で上書きする。
 */
export const DETERMINISTIC_TIME_LIMIT_MS = 3_600_000

/** バリアント識別子 */
export const VARIANT_IDS = {
  A: 'A',
  B: 'B',
} as const

export type VariantId = (typeof VARIANT_IDS)[keyof typeof VARIANT_IDS]

/**
 * 「AI に切り札スートを見せない」エミュレーションの適用先。
 *
 * 本番の `gameState.trumpSuit` は長らく一度も設定されておらず、AI 評価層は
 * `(gameState.trumpSuit as Suit) || 'spades'` で常にスペードを切り札だと
 * 思い込んだまま思考していた（トリック勝敗判定側は
 * `napoleonDeclaration.suit` にフォールバックするため正しく動いていた）。
 *
 * ハーネスは最初から `trumpSuit` を明示設定してこの不具合を回避しているので、
 * そのままでは修正の効果を測れない。このオプションを付けたバリアントでは
 * **AI に渡す局面からだけ** `trumpSuit` を落とし、修正前の本番挙動を再現する。
 * トリック解決 (`gameSimulator.completeTrick`) は本番の
 * `gameLogic.determineWinner` と同じく宣言スートで解決させたいので、
 * ハーネス内部の状態には `trumpSuit` を残したままにする。
 */
export const EMULATE_TRUMP_TARGETS = {
  NONE: 'none',
  A: 'a',
  B: 'b',
  BOTH: 'both',
} as const

export type EmulateTrumpTarget =
  (typeof EMULATE_TRUMP_TARGETS)[keyof typeof EMULATE_TRUMP_TARGETS]

export const EMULATE_TRUMP_TARGET_VALUES: readonly EmulateTrumpTarget[] =
  Object.values(EMULATE_TRUMP_TARGETS)

/** フォールバック理由（例外）を何件まで集計表示するか */
export const MAX_REPORTED_FALLBACK_ERRORS = 10

/** ハーネスのデフォルト値 */
export const AB_DEFAULTS = {
  GAMES: 20,
  SEED: 42,
  VARIANT_A: 'heuristic',
  VARIANT_B: 'hybrid',
  BASELINE: 'heuristic',
  VARIANT_ROLE: VARIANT_ROLES.NAPOLEON_TEAM,
  SETUP_DECLARATION: SETUP_DECLARATION_POLICIES.HEURISTIC,
  EMULATE_MISSING_TRUMP_SUIT: EMULATE_TRUMP_TARGETS.NONE,
  EMULATE_ROLE: VARIANT_ROLES.ALL,
  /** 全員パスが続いた場合の配り直し上限（超えたらそのシードをスキップ） */
  MAX_REDEALS: 20,
  /** 1ゲームのプレイフェーズのループ上限（無限ループ保険） */
  MAX_PLAY_ITERATIONS: 200,
  /** 宣言フェーズのループ上限 */
  MAX_DECLARATION_ITERATIONS: 50,
} as const

/** 出力ログの接頭辞 */
export const LOG_PREFIX = '[ab]'

/** 95% 信頼区間の z 値 */
export const Z_95 = 1.959964

/** 総絵札数（10, J, Q, K, A × 4スート） */
export const TOTAL_FACE_CARDS = NAPOLEON_RULES.TOTAL_FACE_CARDS

/** ハーネスが生成するプレイヤー ID / 名前 */
export const HARNESS_PLAYER_ID_PREFIX = 'player_'
export const HARNESS_PLAYER_NAME_PREFIX = 'AB Seat '
export const HARNESS_GAME_ID_PREFIX = 'ab_'
