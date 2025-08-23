'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GameRoom } from '@/types/game'
import {
  getGameRooms,
  createGameRoom,
  joinGameRoom,
  createPlayer,
} from '@/lib/supabase/gameService'
import { generateGameId, generatePlayerId } from '@/utils/cardUtils'

export default function RoomsPage() {
  const [rooms, setRooms] = useState<GameRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const router = useRouter()

  const loadRooms = async () => {
    try {
      setLoading(true)
      const roomList = await getGameRooms()
      setRooms(roomList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rooms')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRoom = async () => {
    if (!playerName.trim() || !newRoomName.trim()) {
      setError('Please enter both your name and room name')
      return
    }

    try {
      setError(null)
      const playerId = generatePlayerId()
      const roomId = generateGameId()

      // プレイヤー作成
      await createPlayer(playerId, playerName.trim())

      // ルーム作成
      await createGameRoom({
        id: roomId,
        name: newRoomName.trim(),
        playerCount: 1,
        maxPlayers: 4,
        status: 'waiting',
        hostPlayerId: playerId,
      })

      // ルームに参加
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
      const playerId = generatePlayerId()

      // プレイヤー作成
      await createPlayer(playerId, playerName.trim())

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

  useEffect(() => {
    loadRooms()

    // 保存された名前を読み込み
    const savedName = localStorage.getItem('playerName')
    if (savedName) {
      setPlayerName(savedName)
    }

    // 30秒ごとにルーム一覧を更新
    const interval = setInterval(loadRooms, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">
          Napoleon Game Rooms
        </h1>

        {/* プレイヤー名入力 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Enter Your Name</h2>
          <div className="flex gap-4">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your name..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={20}
            />
            <button
              onClick={() => setShowCreateRoom(!showCreateRoom)}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
              disabled={!playerName.trim()}
            >
              Create Room
            </button>
          </div>
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
                onClick={handleCreateRoom}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                disabled={!newRoomName.trim() || !playerName.trim()}
              >
                Create
              </button>
              <button
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
              onClick={loadRooms}
              className="text-blue-600 hover:text-blue-700 text-sm"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600">Loading rooms...</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No rooms available. Create one to get started!
            </div>
          ) : (
            <div className="space-y-3">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-lg">{room.name}</h3>
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
                    <button
                      onClick={() => handleJoinRoom(room.id)}
                      disabled={
                        !playerName.trim() ||
                        room.playerCount >= room.maxPlayers ||
                        room.status !== 'waiting'
                      }
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
                    >
                      {room.playerCount >= room.maxPlayers ? 'Full' : 'Join'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center mt-8">
          <button
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
