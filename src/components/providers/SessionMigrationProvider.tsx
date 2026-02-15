/**
 * セッション移行プロバイダー
 * localStorageからhttpOnlyクッキーへの自動移行を管理
 */

'use client'

import { useSessionMigration } from '@/hooks/useSessionMigration'

export interface SessionMigrationProviderProps {
  children: React.ReactNode
}

/**
 * セッション移行を自動的に実行するプロバイダー
 *
 * 機能:
 * - localStorageにセッションが存在する場合、httpOnlyクッキーに移行
 * - 移行中はローディング表示
 * - 移行完了後、子コンポーネントをレンダリング
 */
export function SessionMigrationProvider({
  children,
}: SessionMigrationProviderProps) {
  const { migrating, error } = useSessionMigration()

  // 移行中：ローディング表示
  if (migrating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4" />
          <div className="text-white text-lg font-semibold">
            🔐 Migrating session...
          </div>
          <div className="text-white/70 text-sm mt-2">
            Upgrading security (XSS protection)
          </div>
        </div>
      </div>
    )
  }

  // 移行エラー：警告表示（ユーザー体験を損なわないため、続行）
  if (error) {
    console.warn('[SessionMigration] Migration failed, continuing:', error)
    // エラーがあってもアプリは継続（既存のlocalStorageフォールバック）
  }

  // 移行完了または不要：通常のレンダリング
  return <>{children}</>
}
