/**
 * A/B 比較用の統計ユーティリティ。
 *
 * 二値の勝敗だけでは分散が大きく、少ゲーム数では差が見えない。
 * 同一配牌に対する対応のある差分 (paired difference) を取ることで
 * 配牌由来の分散を打ち消し、感度を上げる。
 */

import { Z_95 } from './constants'
import type { PairedComparison } from './types'

/** 平均 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0
  let sum = 0
  for (const value of values) sum += value
  return sum / values.length
}

/** 標本標準偏差（不偏, n-1）。n < 2 の場合は 0 */
export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  let sumSquares = 0
  for (const value of values) {
    const d = value - m
    sumSquares += d * d
  }
  return Math.sqrt(sumSquares / (values.length - 1))
}

/**
 * 対応のある比較を計算する（B − A）。
 *
 * @param metric 指標名
 * @param aValues バリアント A の各ゲームの値
 * @param bValues バリアント B の各ゲームの値（aValues と同じ配牌の対）
 */
export function pairedComparison(
  metric: string,
  aValues: number[],
  bValues: number[]
): PairedComparison {
  if (aValues.length !== bValues.length) {
    throw new Error(
      `paired comparison requires equal lengths (a=${aValues.length}, b=${bValues.length})`
    )
  }

  const diffs = bValues.map((b, i) => b - aValues[i])
  const n = diffs.length
  const meanDiff = mean(diffs)
  const sdDiff = standardDeviation(diffs)
  const standardError = n > 0 ? sdDiff / Math.sqrt(n) : 0
  const halfWidth = Z_95 * standardError

  const ci95Lower = meanDiff - halfWidth
  const ci95Upper = meanDiff + halfWidth

  return {
    metric,
    meanDiff,
    sdDiff,
    standardError,
    ci95Lower,
    ci95Upper,
    // 標準誤差 0（全ゲーム同一差分）でも差分が 0 でなければ有意扱いにする
    significant: n > 1 && ci95Lower * ci95Upper > 0,
    n,
  }
}
