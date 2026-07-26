/**
 * Seedable RNG seam.
 *
 * 目的: A/B セルフプレイ計測 (scripts/ab-selfplay.ts) で「同じ配牌を両バリアント
 * に与える」common random numbers を実現するための差し替え可能な乱数源。
 *
 * ⚠️ 最重要な不変条件:
 *   シードが設定されていない間、`random()` は `Math.random()` を「そのまま」
 *   呼び出す。挙動・分布・性能ともに素の `Math.random()` と同一であり、
 *   本番コードの振る舞いは一切変わらない。
 *
 * シードは明示的に `setSeed()` を呼んだ場合のみ有効化され、
 * `resetToMathRandom()` で元に戻る（プロセスグローバル・同期的）。
 */

/** 乱数生成関数のシグネチャ（`Math.random` 互換: [0, 1) を返す） */
export type RandomFn = () => number

/** mulberry32 の状態更新に使う定数群 */
const MULBERRY32 = {
  INCREMENT: 0x6d2b79f5,
  MULTIPLIER_1: 61,
  SHIFT_1: 15,
  SHIFT_2: 7,
  SHIFT_3: 14,
  DIVISOR: 4294967296,
} as const

/** シード未設定時は null（= Math.random を使う） */
let seededRandom: RandomFn | null = null

/** 現在設定されているシード値（未設定なら null） */
let currentSeed: number | null = null

/**
 * mulberry32 PRNG を生成する。
 * 32bit の内部状態のみを持つ軽量な生成器で、統計的品質は
 * シミュレーション用途には十分。
 */
export function createSeededRandom(seed: number): RandomFn {
  // 32bit 符号なし整数に正規化（負値・小数・巨大値も受け付ける）
  let state = Math.trunc(seed) >>> 0

  return function mulberry32(): number {
    state = (state + MULBERRY32.INCREMENT) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> MULBERRY32.SHIFT_1), t | 1)
    t ^=
      t + Math.imul(t ^ (t >>> MULBERRY32.SHIFT_2), t | MULBERRY32.MULTIPLIER_1)
    return ((t ^ (t >>> MULBERRY32.SHIFT_3)) >>> 0) / MULBERRY32.DIVISOR
  }
}

/**
 * 乱数源をシード付き PRNG に切り替える。
 * 同じシードを設定すれば、以降の `random()` 列は完全に再現される。
 */
export function setSeed(seed: number): void {
  currentSeed = Math.trunc(seed) >>> 0
  seededRandom = createSeededRandom(currentSeed)
}

/**
 * 乱数源を `Math.random` に戻す（= 本番と同じ挙動）。
 */
export function resetToMathRandom(): void {
  seededRandom = null
  currentSeed = null
}

/** 現在シードが設定されているか */
export function isSeeded(): boolean {
  return seededRandom !== null
}

/** 現在のシード値（未設定なら null） */
export function getSeed(): number | null {
  return currentSeed
}

/**
 * [0, 1) の乱数を返す。
 * シード未設定時は `Math.random()` を直接呼ぶ（挙動を変えない）。
 */
export function random(): number {
  return seededRandom === null ? Math.random() : seededRandom()
}

/**
 * [0, maxExclusive) の整数を返す。
 */
export function randomInt(maxExclusive: number): number {
  return Math.floor(random() * maxExclusive)
}

/**
 * 与えられた関数の実行中だけシードを固定し、終了後に元の状態へ戻す。
 * ネストした呼び出しや、シード未設定状態への復帰も正しく扱う。
 */
export function withSeed<T>(seed: number, fn: () => T): T {
  const previousRandom = seededRandom
  const previousSeed = currentSeed
  setSeed(seed)
  try {
    return fn()
  } finally {
    seededRandom = previousRandom
    currentSeed = previousSeed
  }
}
