'use client'

import { useEffect } from 'react'
import { subscribeToGameState } from '@/lib/supabase/secureGameService'
import type { GameState } from '@/types/game'

export function useGameSubscription(
  gameId: string | undefined,
  isAuthenticated: boolean,
  onGameStateUpdate: (gameState: GameState) => void
) {
  useEffect(() => {
    if (!gameId || !isAuthenticated) return

    const unsubscribe = subscribeToGameState(gameId, onGameStateUpdate)
    return unsubscribe
  }, [gameId, isAuthenticated, onGameStateUpdate])
}
