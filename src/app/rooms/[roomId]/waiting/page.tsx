'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  getRoomDetailsAction,
  leaveGameRoomAction,
  startGameFromRoomAction,
} from '@/app/actions/gameActions'
import { GAME_ROOM_STATUS } from '@/lib/constants'
import { performanceSupabase } from '@/lib/supabase/performanceClient'
import { subscribeToGameRoom } from '@/lib/supabase/secureGameService'
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
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)

  // Unwrap params
  useEffect(() => {
    params.then((p) => setRoomId(p.roomId))
  }, [params])

  // Load player ID from localStorage
  useEffect(() => {
    const storedPlayerId = localStorage.getItem('playerId')
    if (!storedPlayerId) {
      setError('Player ID not found. Please join from rooms page.')
      setLoading(false)
      return
    }
    setPlayerId(storedPlayerId)
  }, [])

  // Load room details and players
  const loadRoomData = useCallback(async () => {
    if (!roomId) return

    try {
      setLoading(true)

      // ✅ 並列化: ルーム情報とプレイヤー情報を同時取得（50%高速化）
      const [roomResult, playersResult] = await Promise.all([
        getRoomDetailsAction(roomId),
        performanceSupabase.getPlayersInRoom(roomId, {
          includeDisconnected: false,
        }),
      ])

      if (!roomResult.success || !roomResult.room) {
        throw new Error(roomResult.error || 'Room not found')
      }

      if (playersResult.error) {
        throw new Error('Failed to load players')
      }

      setRoom(roomResult.room)
      setIsHost(roomResult.room.hostPlayerId === playerId)
      setPlayers(playersResult.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load room data')
    } finally {
      setLoading(false)
    }
  }, [roomId, playerId])

  // Subscribe to room updates
  useEffect(() => {
    if (!roomId) return

    const unsubscribe = subscribeToGameRoom(roomId, {
      onRoomUpdate: (updatedRoom) => {
        setRoom(updatedRoom)

        // Auto-navigate to game when status changes to playing
        if (updatedRoom.status === GAME_ROOM_STATUS.PLAYING) {
          // Use game_id from room if available, otherwise fall back to room ID
          const gameId = updatedRoom.gameId || roomId
          console.log('🎮 Navigating to game:', gameId, 'from room:', roomId)
          router.push(`/game/${gameId}?multiplayer=true`)
        }
      },
      onPlayerJoin: (player) => {
        setPlayers((prev) => {
          // Check if player already exists
          const exists = prev.some((p) => p.id === player.id)
          if (exists) return prev

          return [
            ...prev,
            {
              id: player.id,
              name: player.name,
              connected: true,
              created_at: new Date().toISOString(),
            },
          ]
        })
        // ✅ 不要I/O削減: リアルタイムサブスクリプションで既に更新済みのためDB再取得不要
        // ルームのプレイヤー数のみローカル更新
        setRoom((prev) =>
          prev ? { ...prev, playerCount: prev.playerCount + 1 } : null
        )
      },
      onPlayerLeave: (playerId) => {
        setPlayers((prev) => prev.filter((p) => p.id !== playerId))
        // ✅ 不要I/O削減: リアルタイムサブスクリプションで既に更新済みのためDB再取得不要
        // ルームのプレイヤー数のみローカル更新
        setRoom((prev) =>
          prev ? { ...prev, playerCount: prev.playerCount - 1 } : null
        )
      },
      onError: (error) => {
        console.error('Room subscription error:', error)
        setError(error.message)
      },
    })

    return () => {
      unsubscribe()
    }
  }, [roomId, router])

  // Initial data load
  useEffect(() => {
    if (roomId && playerId) {
      loadRoomData()
    }
  }, [roomId, playerId, loadRoomData])

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
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                {room && room.playerCount < 4
                  ? `Waiting for ${4 - room.playerCount} more player${4 - room.playerCount > 1 ? 's' : ''}...`
                  : 'Start Game'}
              </button>
            )}
            <button
              type="button"
              onClick={handleLeaveRoom}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
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
