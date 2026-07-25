'use client'

import { useEffect, useRef } from 'react'

interface UseGameInitializationProps {
  /**
   * httpOnlyクッキーのセッションが読み込み済みかどうか。
   * Server Action の認可はセッションクッキーに依存するため、
   * セッション確立前に初期化を走らせてはならない。
   */
  isSessionReady: boolean
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
  isSessionReady,
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
    if (!isSessionReady) return
    if (hasGameState || isLoading || isInitialized) return

    // 同じゲームIDで初期化を試みた場合は重複を防ぐ
    if (initializationAttempted.current === gameId) return

    if (gameId && isAI) {
      initializationAttempted.current = gameId
      initGameRef.current(['You'])
    } else if (gameId && playerNames && playerNames.length === 4) {
      initializationAttempted.current = gameId
      initGameRef.current(playerNames)
    } else if (gameId && !playerNames) {
      initializationAttempted.current = gameId
      loadGameRef.current(gameId)
    }
  }, [
    isSessionReady,
    gameId,
    hasGameState,
    isInitialized,
    isLoading,
    playerNames,
    isAI,
  ])
}
