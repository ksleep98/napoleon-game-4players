'use client'

import { useCallback, useEffect, useRef } from 'react'
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
    if (!gameId || !isAuthenticated) return

    const unsubscribe = subscribeToGameState(gameId, stableCallback)
    return unsubscribe
  }, [gameId, isAuthenticated, stableCallback])
}
