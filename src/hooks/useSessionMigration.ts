/**
 * localStorageからhttpOnlyクッキーへの自動移行Hook
 * Phase 2（移行フェーズ）で使用
 */

'use client'

import { useEffect, useState } from 'react'
import { createSessionAction } from '@/app/actions/cookieSessionActions'
import {
  clearSecurePlayer,
  getSecurePlayerId,
  getSecurePlayerName,
} from '@/utils/secureStorage'

export interface SessionMigrationState {
  migrated: boolean
  migrating: boolean
  error: string | null
}

/**
 * localStorageセッションをhttpOnlyクッキーに自動移行するHook
 *
 * 使用例:
 * ```tsx
 * function App() {
 *   const { migrated, migrating } = useSessionMigration();
 *
 *   if (migrating) {
 *     return <LoadingSpinner />;
 *   }
 *
 *   return <YourApp />;
 * }
 * ```
 */
export function useSessionMigration(): SessionMigrationState {
  const [state, setState] = useState<SessionMigrationState>({
    migrated: false,
    migrating: true,
    error: null,
  })

  useEffect(() => {
    const migrateSession = async () => {
      try {
        // localStorageにセッションがあるか確認
        const playerId = getSecurePlayerId()
        const playerName = getSecurePlayerName()

        // セッションがない場合、移行不要
        if (!playerId || !playerName) {
          setState({
            migrated: true,
            migrating: false,
            error: null,
          })
          return
        }

        console.info(
          '[Migration] Found localStorage session, migrating to cookie...'
        )

        // クッキーに移行
        const result = await createSessionAction(playerId, playerName)

        if (result.success) {
          // 移行成功：localStorageをクリア
          clearSecurePlayer()
          console.info(
            '[Migration] ✅ Session migrated from localStorage to httpOnly cookie'
          )

          setState({
            migrated: true,
            migrating: false,
            error: null,
          })
        } else {
          // 移行失敗：エラー記録（localStorageは保持）
          console.error(
            '[Migration] ❌ Failed to migrate session:',
            result.error
          )

          setState({
            migrated: false,
            migrating: false,
            error: result.error || 'Migration failed',
          })
        }
      } catch (error) {
        console.error('[Migration] ❌ Migration error:', error)

        setState({
          migrated: false,
          migrating: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    migrateSession()
  }, [])

  return state
}

/**
 * 移行ステータスのみを返すシンプル版Hook
 */
export function useSessionMigrationSimple(): boolean {
  const { migrated } = useSessionMigration()
  return migrated
}
