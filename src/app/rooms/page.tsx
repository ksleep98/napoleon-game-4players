'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { deleteGameRoomAction } from '@/app/actions/gameActions'
import {
  createGameRoom,
  createPlayer,
  getGameRooms,
  joinGameRoom,
} from '@/lib/supabase/secureGameService'
import { FEATURE_FLAGS, getEnvironment } from '@/lib/utils/environment'
import type { GameRoom } from '@/types/game'
import { generateGameId, generatePlayerId } from '@/utils/cardUtils'

export default function RoomsPage() {
  const [rooms, setRooms] = useState<GameRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null)
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null)
  const [confirmDeleteRoomId, setConfirmDeleteRoomId] = useState<string | null>(
    null
  )
  const router = useRouter()

  const loadRooms = useCallback(async () => {
    try {
      setLoading(true)
      const roomList = await getGameRooms()
      setRooms(roomList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rooms')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleCreateRoom = async () => {
    if (!playerName.trim() || !newRoomName.trim()) {
      setError('Please enter both your name and room name')
      return
    }

    try {
      setError(null)
      // 既存のplayerIdを再利用（ホストが退出→再参加した場合に重要）
      let playerId = localStorage.getItem('playerId')
      const isNewPlayer = !playerId

      if (!playerId) {
        playerId = generatePlayerId()
      }

      const roomId = generateGameId()

      // ルーム作成（playerCount: 0 で初期化）
      await createGameRoom({
        id: roomId,
        name: newRoomName.trim(),
        playerCount: 0,
        maxPlayers: 4,
        status: 'waiting',
        hostPlayerId: playerId,
      })

      // 新規プレイヤーの場合のみプレイヤー作成
      if (isNewPlayer) {
        await createPlayer(playerId, playerName.trim())
      }

      // ホストプレイヤーをルームに参加（これで player_count が 0 → 1 になる）
      await joinGameRoom(roomId, playerId)

      // プレイヤーIDをローカルストレージに保存
      localStorage.setItem('playerId', playerId)
      localStorage.setItem('playerName', playerName.trim())

      // ウェイティングルームページに移動
      router.push(`/rooms/${roomId}/waiting`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room')
    }
  }

  const handleJoinRoom = async (roomId: string) => {
    if (!playerName.trim()) {
      setError('Please enter your name')
      return
    }

    try {
      setError(null)
      // 既存のplayerIdを再利用（退出→再参加した場合に重要）
      let playerId = localStorage.getItem('playerId')
      const isNewPlayer = !playerId

      if (!playerId) {
        playerId = generatePlayerId()
      }

      // 新規プレイヤーの場合のみプレイヤー作成
      if (isNewPlayer) {
        await createPlayer(playerId, playerName.trim())
      }

      // ルームに参加
      await joinGameRoom(roomId, playerId)

      // プレイヤーIDをローカルストレージに保存
      localStorage.setItem('playerId', playerId)
      localStorage.setItem('playerName', playerName.trim())

      // ウェイティングルームページに移動
      router.push(`/rooms/${roomId}/waiting`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room')
    }
  }

  const handleDeleteRoom = async (roomId: string) => {
    const playerId = localStorage.getItem('playerId')
    if (!playerId) {
      setError('Player ID not found. Please refresh the page.')
      return
    }

    try {
      setError(null)
      setDeletingRoomId(roomId)

      const result = await deleteGameRoomAction(roomId, playerId)

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete room')
      }

      // ルーム一覧を再読み込み
      await loadRooms()
      setConfirmDeleteRoomId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete room')
    } finally {
      setDeletingRoomId(null)
    }
  }

  useEffect(() => {
    loadRooms()

    // 保存された名前とplayerIdを読み込み
    const savedName = localStorage.getItem('playerName')
    if (savedName) {
      setPlayerName(savedName)
    }

    const savedPlayerId = localStorage.getItem('playerId')
    if (savedPlayerId) {
      setCurrentPlayerId(savedPlayerId)
    }

    // 30秒ごとにルーム一覧を更新
    const interval = setInterval(loadRooms, 30000)
    return () => clearInterval(interval)
  }, [loadRooms])

  // マルチプレイヤー機能が無効な場合の表示
  if (!FEATURE_FLAGS.MULTIPLAYER_ROOMS) {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <h1 className="text-3xl font-bold mb-4">Multiplayer Rooms</h1>
            <div className="mb-6">
              <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                🚧 Coming Soon
              </span>
            </div>
            <p className="text-gray-600 mb-6">
              Multiplayer rooms are currently in development and only available
              in local environment.
            </p>
            <p className="text-sm text-gray-500 mb-8">
              Environment:{' '}
              <code className="bg-gray-100 px-2 py-1 rounded">
                {getEnvironment()}
              </code>
            </p>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">Game Rooms</h1>

        {/* プレイヤー名入力 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Join or Create a Room</h2>
          <div className="flex gap-4 mb-3">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your name..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={20}
            />
            <button
              type="button"
              onClick={() => setShowCreateRoom(!showCreateRoom)}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
              disabled={!playerName.trim()}
            >
              Create Room
            </button>
          </div>
          {currentPlayerId && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-600">
                <span className="font-semibold">Your Player ID:</span>{' '}
                <code className="bg-yellow-100 px-2 py-1 rounded font-mono">
                  {currentPlayerId}
                </code>
                <span className="ml-2 text-red-600">
                  ⚠️
                  4つの異なるブラウザ（Chrome/Safari/Firefox/Edge）またはシークレットモードを使用してください
                </span>
              </p>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('playerId')
                  localStorage.removeItem('playerName')
                  window.location.reload()
                }}
                className="text-xs px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded"
                title="新しいPlayer IDを生成するためにリセット"
              >
                🔄 Reset ID
              </button>
            </div>
          )}
        </div>

        {/* 新しいルーム作成 */}
        {showCreateRoom && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Create New Room</h2>
            <div className="flex gap-4">
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={50}
              />
              <button
                type="button"
                onClick={handleCreateRoom}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                disabled={!newRoomName.trim() || !playerName.trim()}
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateRoom(false)
                  setNewRoomName('')
                }}
                className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
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

        {/* ルーム一覧 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Available Rooms</h2>
            <button
              type="button"
              onClick={loadRooms}
              className="text-blue-600 hover:text-blue-700 text-sm"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading rooms...</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No rooms available. Create one to get started!
            </div>
          ) : (
            <div className="space-y-4">
              {rooms.map((room) => {
                const isHost = currentPlayerId === room.hostPlayerId
                return (
                  <div
                    key={room.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{room.name}</h3>
                          {isHost && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                              Host
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 space-x-4">
                          <span>
                            Players: {room.playerCount}/{room.maxPlayers}
                          </span>
                          <span>Status: {room.status}</span>
                          <span>
                            Created: {room.createdAt.toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleJoinRoom(room.id)}
                          disabled={
                            !playerName.trim() ||
                            room.playerCount >= room.maxPlayers ||
                            room.status !== 'waiting'
                          }
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
                        >
                          {room.playerCount >= room.maxPlayers
                            ? 'Full'
                            : 'Join'}
                        </button>
                        {isHost && (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteRoomId(room.id)}
                            disabled={deletingRoomId === room.id}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
                            title="Delete room"
                          >
                            {deletingRoomId === room.id ? '...' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 削除確認ダイアログ */}
        {confirmDeleteRoomId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
              <h3 className="text-xl font-bold mb-4">Delete Room</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this room? This action cannot be
                undone.
              </p>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => handleDeleteRoom(confirmDeleteRoomId)}
                  disabled={deletingRoomId === confirmDeleteRoomId}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
                >
                  {deletingRoomId === confirmDeleteRoomId
                    ? 'Deleting...'
                    : 'Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteRoomId(null)}
                  disabled={deletingRoomId === confirmDeleteRoomId}
                  className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mt-8">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-blue-600 hover:text-blue-700"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}
