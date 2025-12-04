'use client'

import { useEffect, useRef } from 'react'

interface UseGameInitializationProps {
  gameId: string | undefined
  playerNames: string[] | undefined
  isAI: boolean | undefined
  hasGameState: boolean
  isLoading: boolean
  isInitialized: boolean
  initGame: (names: string[]) => void
  loadGame: (id: string) => void
}

export function useGameInitialization({
  gameId,
  playerNames,
  isAI,
  hasGameState,
  isLoading,
  isInitialized,
  initGame,
  loadGame,
}: UseGameInitializationProps) {
  const initializationAttempted = useRef<string | null>(null)

  // コールバック関数の参照を安定化
  const initGameRef = useRef(initGame)
  initGameRef.current = initGame

  const loadGameRef = useRef(loadGame)
  loadGameRef.current = loadGame

  useEffect(() => {
    if (hasGameState || isLoading || isInitialized) return

    // 同じゲームIDで初期化を試みた場合は重複を防ぐ
    if (initializationAttempted.current === gameId) return

    if (gameId && isAI) {
      console.log('Creating new AI game:', gameId)
      initializationAttempted.current = gameId
      initGameRef.current(['You'])
    } else if (gameId && playerNames && playerNames.length === 4) {
      console.log('Creating new game for Quick Start:', gameId, playerNames)
      initializationAttempted.current = gameId
      initGameRef.current(playerNames)
    } else if (gameId && !playerNames) {
      console.log('Loading existing game:', gameId)
      initializationAttempted.current = gameId
      loadGameRef.current(gameId)
    }
  }, [gameId, hasGameState, isInitialized, isLoading, playerNames, isAI])
}
