/**
 * Environment Detection Utilities
 * 実行環境の判定とフィーチャーフラグ管理
 */

export type Environment = 'local' | 'vercel-develop' | 'vercel-main' | 'unknown'

/**
 * 現在の実行環境を判定
 */
export function getEnvironment(): Environment {
  // サーバーサイドレンダリング時
  if (typeof window === 'undefined') {
    if (process.env.VERCEL) {
      // Vercel環境での分岐判定
      if (process.env.VERCEL_GIT_COMMIT_REF === 'main') {
        return 'vercel-main'
      }
      if (process.env.VERCEL_GIT_COMMIT_REF === 'develop') {
        return 'vercel-develop'
      }
      return 'vercel-develop' // デフォルトはdevelop扱い
    }
    return 'local'
  }

  // クライアントサイド判定
  const hostname = window.location.hostname

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'local'
  }

  if (hostname.includes('vercel.app')) {
    // URLから環境を推定
    if (hostname.includes('napoleon-game') && !hostname.includes('-git-')) {
      return 'vercel-main' // main branch (production)
    }
    return 'vercel-develop' // develop branch (preview)
  }

  return 'unknown'
}

/**
 * 環境チェック用ヘルパー関数
 */
export const isLocal = (): boolean => getEnvironment() === 'local'
export const isVercel = (): boolean => getEnvironment().startsWith('vercel')
export const isProduction = (): boolean => getEnvironment() === 'vercel-main'
export const isDevelopment = (): boolean =>
  getEnvironment() === 'local' || getEnvironment() === 'vercel-develop'

/**
 * フィーチャーフラグ管理
 * 環境別に機能の有効/無効を制御
 */
export const FEATURE_FLAGS = {
  /**
   * 人間4人対戦機能（マルチプレイヤー）
   * 現在は開発中のためローカルのみ有効
   */
  MULTIPLAYER_ROOMS: isLocal(),

  /**
   * パフォーマンス監視
   * 開発環境でのみ有効
   */
  PERFORMANCE_MONITORING: isDevelopment(),

  /**
   * デバッグツール表示
   * 開発環境でのみ有効
   */
  DEBUG_TOOLS: isDevelopment(),

  /**
   * 詳細ログ出力
   * ローカル環境でのみ有効
   */
  VERBOSE_LOGGING: isLocal(),

  /**
   * 実験的機能
   * ローカル環境でのみ有効
   */
  EXPERIMENTAL_FEATURES: isLocal(),
} as const

/**
 * 環境情報を表示用に整形
 */
export function getEnvironmentInfo() {
  const env = getEnvironment()
  const features = Object.entries(FEATURE_FLAGS)
    .filter(([_, enabled]) => enabled)
    .map(([feature, _]) => feature)

  return {
    environment: env,
    isProduction: isProduction(),
    enabledFeatures: features,
    hostname:
      typeof window !== 'undefined' ? window.location.hostname : 'server',
    buildTime: process.env.BUILD_TIME || 'unknown',
    commitRef: process.env.VERCEL_GIT_COMMIT_REF || 'local',
  }
}

/**
 * 開発者向け環境デバッグ情報
 */
export function debugEnvironment() {
  if (typeof window !== 'undefined') {
    console.group('🌍 Environment Debug Info')
    console.log('Current Environment:', getEnvironment())
    console.log('Hostname:', window.location.hostname)
    console.log('Feature Flags:', FEATURE_FLAGS)
    console.log('Full Info:', getEnvironmentInfo())
    console.groupEnd()
  }
}
