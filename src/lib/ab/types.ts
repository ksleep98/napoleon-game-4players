/**
 * A/B セルフプレイ計測ハーネスの型定義。
 */

import type { AIStrategyConfig } from '@/lib/ai/aiStrategy'
import type { GameState, Suit } from '@/types/game'
import type {
  EmulateTrumpTarget,
  SetupDeclarationPolicy,
  VariantId,
  VariantRole,
} from './constants'

/** CLI から解釈した 1 バリアントの指定 */
export interface VariantSpec {
  /** 表示用ラベル（例: "mcts:strong"） */
  label: string
  /** selectAICard に渡す設定 */
  config: AIStrategyConfig
}

/** 1 ゲーム分のセットアップ結果（両バリアントで共有する初期局面） */
export interface GameSetup {
  /** プレイフェーズ開始直前の状態 */
  state: GameState
  /** 配り直し回数 */
  redeals: number
  /** ナポレオンのプレイヤー ID */
  napoleonPlayerId: string
  /** 副官のプレイヤー ID（副官カードが隠しカードにあった場合は undefined） */
  adjutantPlayerId?: string
  /** 宣言絵札数 */
  targetFaceCards: number
  /** 切り札スート */
  trumpSuit: Suit
}

/** 1 ゲームの計測結果 */
export interface GameOutcome {
  seed: number
  /** 宣言された切り札スート（スート別内訳の集計キー） */
  trumpSuit: Suit
  /** この局で切り札スートを隠した席数（修正前挙動のエミュレーション） */
  trumpSuitHiddenSeats: number
  napoleonWon: boolean
  /** ナポレオンチームの獲得絵札数 */
  napoleonFaceCards: number
  /** 宣言絵札数 */
  targetFaceCards: number
  /** マージン = 獲得絵札 − 宣言数 */
  margin: number
  /** 完了トリック数 */
  tricksPlayed: number
  /** variant 側の意思決定回数 */
  variantDecisions: number
  /** variant 側の意思決定に要した総時間(ms) */
  variantDecisionMs: number
  /** variant 側で戦略評価が throw してランダムに落ちた回数 */
  variantFallbacks: number
  /** 全席合計の意思決定回数 */
  totalDecisions: number
  /** 全席合計の意思決定時間(ms) */
  totalDecisionMs: number
  /** 全席合計のフォールバック回数 */
  totalFallbacks: number
  /**
   * フォールバックを引き起こした例外の内訳（署名 → 回数）。
   * 署名は `${例外名}: ${メッセージ} @ ${最初のスタックフレーム}`。
   */
  fallbackErrors: Record<string, number>
  /** 配り直し回数 */
  redeals: number
}

/** 1 バリアントの集計 */
export interface VariantSummary {
  id: VariantId
  label: string
  games: number
  napoleonWins: number
  napoleonWinRate: number
  meanFaceCards: number
  meanMargin: number
  sdMargin: number
  meanTricksPlayed: number
  /** variant 側 1 手あたりの平均思考時間(ms) */
  meanVariantDecisionMs: number
  /** 全席 1 手あたりの平均思考時間(ms) */
  meanDecisionMs: number
  totalDecisions: number
  /** 戦略評価が throw してランダム選択に落ちた割合（全席） */
  fallbackRate: number
  totalFallbacks: number
  /** フォールバック理由の内訳（多い順） */
  fallbackErrors: FallbackErrorCount[]
}

/** フォールバック理由 1 件 */
export interface FallbackErrorCount {
  signature: string
  count: number
}

/** 宣言スート別の内訳 */
export interface SuitBreakdown {
  suit: Suit
  games: number
  aNapoleonWins: number
  bNapoleonWins: number
  aNapoleonWinRate: number
  bNapoleonWinRate: number
  aMeanMargin: number
  bMeanMargin: number
  napoleonWinRate: PairedComparison
  margin: PairedComparison
}

/** 対応のある比較（B − A） */
export interface PairedComparison {
  metric: string
  meanDiff: number
  sdDiff: number
  standardError: number
  ci95Lower: number
  ci95Upper: number
  /** 95% 信頼区間が 0 を跨がないか */
  significant: boolean
  n: number
}

/** ハーネスの実行オプション */
export interface ABRunOptions {
  games: number
  seed: number
  variantA: VariantSpec
  variantB: VariantSpec
  baseline: VariantSpec
  variantRole: VariantRole
  setupDeclaration: SetupDeclarationPolicy
  maxRedeals: number
  /**
   * どちらのバリアントで「trumpSuit 未設定の修正前挙動」を再現するか。
   * 省略時は `none`（両バリアントとも切り札を正しく認識する）。
   */
  emulateMissingTrumpSuit?: EmulateTrumpTarget
  /**
   * エミュレーション対象バリアントの中で、どの席の視界から `trumpSuit` を
   * 落とすか。省略時は `all`（全席 = 修正前の本番と同じ）。
   * `napoleon-team` / `allied` を指定すると、切り札認識の効果を
   * チーム別に分解して測れる。
   */
  emulateRole?: VariantRole
  /** ゲームごとに 1 行ログを出すか */
  progress: boolean
  /** 進捗ログの出力先（テストでは差し替える） */
  logger?: (message: string) => void
}

/** ハーネスの実行結果 */
export interface ABResult {
  meta: {
    games: number
    requestedGames: number
    seed: number
    variantRole: VariantRole
    setupDeclaration: SetupDeclarationPolicy
    emulateMissingTrumpSuit: EmulateTrumpTarget
    emulateRole: VariantRole
    baselineLabel: string
    skippedSeeds: number[]
    elapsedMs: number
    gamesPerSecond: number
  }
  variantA: VariantSummary
  variantB: VariantSummary
  paired: {
    napoleonWinRate: PairedComparison
    margin: PairedComparison
    faceCards: PairedComparison
  }
  /** 宣言スート別の内訳（ゲーム数の多い順） */
  bySuit: SuitBreakdown[]
  games: Array<{
    seed: number
    a: GameOutcome
    b: GameOutcome
  }>
}
