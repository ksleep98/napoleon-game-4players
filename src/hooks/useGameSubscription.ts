'use client'

import { useCallback, useEffect, useRef } from 'react'
import { loadGameStateAction } from '@/app/actions/gameActions'
import { supabase } from '@/lib/supabase/client'
import { subscribeToGameState } from '@/lib/supabase/secureGameService'
import type { GameState } from '@/types/game'

export function useGameSubscription(
  gameId: string | undefined,
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
      console.log('⚠️  No gameId provided, skipping subscription')
      return
    }

    // マルチプレイヤーモード（gameIdが'game_'で始まる場合）ではポーリングを使用
    const isMultiplayerRoom = gameId.startsWith('game_')

    if (isMultiplayerRoom) {
      console.log('📡 Using Supabase Broadcast for multiplayer room:', gameId)

      // マルチプレイヤーモードではlocalStorageからplayerIdを取得
      const getPlayerId = () => {
        if (typeof window !== 'undefined') {
          return localStorage.getItem('playerId')
        }
        return null
      }

      const playerId = getPlayerId()
      if (!playerId) {
        console.error('❌ No playerId found in localStorage')
        return
      }

      console.log('🔑 Using playerId:', playerId)

      // 初回ロード
      loadGameStateAction(gameId, playerId)
        .then((result) => {
          if (result.success && result.gameState) {
            console.log('✅ Initial game state loaded via Broadcast')
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
        .on('broadcast', { event: 'game-updated' }, async (payload) => {
          console.log('📨 Received game update broadcast:', payload)

          // ゲーム状態を再取得
          try {
            const result = await loadGameStateAction(gameId, playerId)
            if (result.success && result.gameState) {
              console.log('✅ Game state updated from broadcast')
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
        .subscribe((status) => {
          console.log('📡 Broadcast channel status:', status)
        })

      return () => {
        console.log('🔌 Unsubscribing from broadcast channel')
        supabase.removeChannel(channel)
      }
    }

    // 通常のゲームモード（AIモード）ではリアルタイムサブスクリプションを使用
    if (!isAuthenticated) {
      console.log(
        '🔒 Waiting for authentication before subscribing to game state'
      )
      return
    }

    console.log('📡 Subscribing to game state:', gameId)
    const unsubscribe = subscribeToGameState(gameId, stableCallback)

    return () => {
      console.log('🔌 Unsubscribing from game state:', gameId)
      unsubscribe()
    }
  }, [gameId, isAuthenticated, stableCallback])
}
