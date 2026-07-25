'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  getRoomDetailsAction,
  leaveGameRoomAction,
  setPlayerOnlineAction,
  startGameFromRoomAction,
} from '@/app/actions/gameActions'
import { usePlayerSession } from '@/hooks/useSupabase'
import { GAME_ROOM_STATUS } from '@/lib/constants'
import { supabase } from '@/lib/supabase/client'
import type { GameRoom } from '@/types/game'

interface WaitingRoomPageProps {
  params: Promise<{ roomId: string }>
}

interface RoomPlayer {
  id: string
  name: string
  connected: boolean
  created_at: string
}

export default function WaitingRoomPage({ params }: WaitingRoomPageProps) {
  const router = useRouter()
  const [roomId, setRoomId] = useState<string | null>(null)
  const [room, setRoom] = useState<GameRoom | null>(null)
  const [players, setPlayers] = useState<RoomPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)

  // Phase 5: httpOnlyクッキーのセッションのみを信頼する（localStorage廃止）
  const { playerId, isSessionLoaded } = usePlayerSession()

  // Unwrap params
  useEffect(() => {
    params.then((p) => setRoomId(p.roomId))
  }, [params])

  // セッション確立を待ってオンライン状態を設定する
  useEffect(() => {
    if (!isSessionLoaded) return

    if (!playerId) {
      setError('Player session not found. Please join from rooms page.')
      setLoading(false)
      return
    }

    // プレイヤーをオンラインに設定
    setPlayerOnlineAction(playerId)
      .then((result) => {
        if (!result.success) {
          console.error('❌ Failed to set player online:', result.error)
        }
      })
      .catch((err) => {
        console.error('❌ Error setting player online:', err)
      })
  }, [isSessionLoaded, playerId])

  // Poll room updates (ポーリング方式でルーム更新を監視)
  useEffect(() => {
    if (!roomId || !playerId) return

    // 前回の状態を保存（変更検出用）
    let lastPlayerCount = 0
    let lastStatus = ''

    // ポーリング関数
    const pollRoomUpdates = async () => {
      try {
        const [roomResult, playersResult] = await Promise.all([
          getRoomDetailsAction(roomId, playerId),
          supabase
            .from('players')
            .select('id, name, connected, created_at')
            .eq('room_id', roomId)
            .eq('connected', true)
            .order('created_at', { ascending: false })
            .limit(50),
        ])

        if (roomResult.success && roomResult.room) {
          const updatedRoom = roomResult.room

          // 変更があった場合のみ更新
          const hasChanged =
            updatedRoom.playerCount !== lastPlayerCount ||
            updatedRoom.status !== lastStatus

          if (hasChanged || lastPlayerCount === 0) {
            setRoom(updatedRoom)
            setIsHost(updatedRoom.isHost === true)
            setLoading(false)

            lastPlayerCount = updatedRoom.playerCount
            lastStatus = updatedRoom.status
          }

          // ゲーム開始時に自動遷移
          if (updatedRoom.status === GAME_ROOM_STATUS.PLAYING) {
            const gameId = updatedRoom.gameId || roomId
            router.push(`/game/${gameId}?multiplayer=true`)
            return // ナビゲーション後はポーリング停止
          }
        }

        // プレイヤーリストを更新（変更があった場合のみ）
        if (!playersResult.error && playersResult.data) {
          setPlayers((prev) => {
            const hasPlayerChanged =
              JSON.stringify(prev) !== JSON.stringify(playersResult.data)
            return hasPlayerChanged ? playersResult.data : prev
          })
        }
      } catch (err) {
        console.error('Room polling error:', err)
        setError(
          err instanceof Error ? err.message : 'Failed to load room data'
        )
        setLoading(false)
      }
    }

    // 初回実行
    pollRoomUpdates()

    // 2秒ごとにポーリング（負荷軽減）
    const intervalId = setInterval(pollRoomUpdates, 2000)

    return () => {
      clearInterval(intervalId)
    }
  }, [roomId, playerId, router])

  const handleStartGame = async () => {
    if (!room || !playerId || !isHost || !roomId) return

    if (room.playerCount < 4) {
      setError('Need 4 players to start the game')
      return
    }

    try {
      setError(null)

      const result = await startGameFromRoomAction(roomId, playerId)

      if (!result.success) {
        throw new Error(result.error || 'Failed to start game')
      }

      // The room subscription will auto-navigate when status changes to 'playing'
      // But we can also navigate immediately with the gameId
      if (result.gameId) {
        router.push(`/game/${result.gameId}?multiplayer=true`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game')
    }
  }

  const handleLeaveRoom = async () => {
    if (!roomId || !playerId) return

    try {
      const result = await leaveGameRoomAction(roomId, playerId)

      if (!result.success) {
        throw new Error(result.error || 'Failed to leave room')
      }

      router.push('/rooms')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave room')
    }
  }

  if (!roomId || !playerId) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-red-600 mb-4">Invalid room or player session</p>
          <button
            type="button"
            onClick={() => router.push('/rooms')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Back to Rooms
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading room...</p>
        </div>
      </div>
    )
  }

  if (error && !room) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            type="button"
            onClick={() => router.push('/rooms')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Back to Rooms
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Room Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold">{room?.name}</h1>
              <p className="text-gray-600 mt-2">
                Waiting for players... ({room?.playerCount || 0}/4)
              </p>
            </div>
            <div className="flex gap-2">
              {isHost && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                  👑 Host
                </span>
              )}
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  room?.status === GAME_ROOM_STATUS.WAITING
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {room?.status || 'unknown'}
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
              <button
                type="button"
                onClick={() => setError(null)}
                className="float-right text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          )}

          {/* Players List */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Players</h2>
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }, (_, i) => i).map((slotIndex) => {
                const player = players[slotIndex]
                const slotKey = player?.id || `empty-slot-${slotIndex}`
                return (
                  <div
                    key={slotKey}
                    className={`border-2 rounded-lg p-4 ${
                      player
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 bg-gray-50 border-dashed'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                            player ? 'bg-blue-600' : 'bg-gray-400'
                          }`}
                        >
                          {player ? player.name[0].toUpperCase() : '?'}
                        </div>
                        <div>
                          <p className="font-semibold">
                            {player ? player.name : `Waiting...`}
                          </p>
                          {player && player.id === playerId && (
                            <p className="text-xs text-blue-600">You</p>
                          )}
                          {player && player.id === room?.hostPlayerId && (
                            <p className="text-xs text-yellow-600">Host</p>
                          )}
                        </div>
                      </div>
                      {player && (
                        <div
                          className={`w-3 h-3 rounded-full ${
                            player.connected ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                          title={
                            player.connected ? 'Connected' : 'Disconnected'
                          }
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            {isHost && (
              <button
                type="button"
                onClick={handleStartGame}
                disabled={!room || room.playerCount < 4}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors cursor-pointer"
              >
                {room && room.playerCount < 4
                  ? `Waiting for ${4 - room.playerCount} more player${4 - room.playerCount > 1 ? 's' : ''}...`
                  : 'Start Game'}
              </button>
            )}
            <button
              type="button"
              onClick={handleLeaveRoom}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Leave Room
            </button>
          </div>

          {/* Game Instructions */}
          {!isHost && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                ⏳ Waiting for the host to start the game when all players are
                ready...
              </p>
            </div>
          )}
        </div>

        {/* Room Info */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Room Information</h2>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-semibold">Room ID:</span>{' '}
              <code className="bg-gray-100 px-2 py-1 rounded">{roomId}</code>
            </p>
            {/* F-2: プレイヤーIDは画面に描画しない（列挙・共有の防止） */}
            <p>
              <span className="font-semibold">Created:</span>{' '}
              {room?.createdAt
                ? new Date(room.createdAt).toLocaleString()
                : 'Unknown'}
            </p>
            <p>
              <span className="font-semibold">Game Type:</span> Napoleon (4
              Players)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
