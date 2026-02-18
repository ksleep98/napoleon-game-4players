'use client'

import { useCallback, useEffect, useRef } from 'react'
import { loadGameStateAction } from '@/app/actions/gameActions'
import { BROADCAST_EVENTS, GAME_ID_PREFIXES } from '@/lib/constants'
import { supabase } from '@/lib/supabase/client'
import { subscribeToGameState } from '@/lib/supabase/secureGameService'
import type { GameState } from '@/types/game'

export function useGameSubscription(
  gameId: string | undefined,
  playerId: string | null,
  isAuthenticated: boolean,
  onGameStateUpdate: (gameState: GameState) => void
) {
  // コールバック関数の参照を安定化
  const onGameStateUpdateRef = useRef(onGameStateUpdate)
  onGameStateUpdateRef.current = onGameStateUpdate

  // 安定化されたコールバック
  const stableCallback = useCallback((gameState: GameState) => {
    onGameStateUpdateRef.current(gameState)
  }, [])

  useEffect(() => {
    if (!gameId) {
      return
    }

    // マルチプレイヤーモード（gameIdが'game_'で始まる場合）ではポーリングを使用
    const isMultiplayerRoom = gameId.startsWith(GAME_ID_PREFIXES.MULTIPLAYER)

    if (isMultiplayerRoom) {
      // Phase 4: httpOnlyクッキーからplayerIdを取得（引数で受け取る）
      if (!playerId) {
        console.error('❌ No playerId provided')
        return
      }

      // 初回ロード
      loadGameStateAction(gameId, playerId)
        .then((result) => {
          if (result.success && result.gameState) {
            stableCallback(result.gameState)
          } else {
            console.error('❌ Failed to load initial game state:', result.error)
          }
        })
        .catch((err) => {
          console.error('❌ Initial game state load threw error:', err)
        })

      // Supabase Broadcastチャンネルを購読（RLS不要！）
      const channel = supabase.channel(`game:${gameId}`)

      channel
        .on('broadcast', { event: BROADCAST_EVENTS.GAME_UPDATED }, async () => {
          // ゲーム状態を再取得
          try {
            const result = await loadGameStateAction(gameId, playerId)
            if (result.success && result.gameState) {
              stableCallback(result.gameState)
            } else {
              console.error(
                '❌ Failed to load game state after broadcast:',
                result.error
              )
            }
          } catch (err) {
            console.error('❌ Error loading game state after broadcast:', err)
          }
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }

    // 通常のゲームモード（AIモード）ではリアルタイムサブスクリプションを使用
    if (!isAuthenticated || !playerId) {
      return
    }

    const unsubscribe = subscribeToGameState(
      gameId,
      playerId, // Phase 4: playerId引数追加（localStorage依存削除）
      stableCallback
    )

    return () => {
      unsubscribe()
    }
  }, [gameId, playerId, isAuthenticated, stableCallback])
}
