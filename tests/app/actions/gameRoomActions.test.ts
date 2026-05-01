/**
 * Tests for Game Room Server Actions
 */

import {
  createGameRoomAction,
  deleteGameRoomAction,
  getGameRoomsAction,
  getRoomDetailsAction,
  invalidateSessionAction,
  joinGameRoomAction,
  leaveGameRoomAction,
  refreshSessionAction,
  setPlayerOfflineAction,
  setPlayerOnlineAction,
  startGameFromRoomAction,
} from '@/app/actions/gameActions'
import type { GameRoom } from '@/types/game'

// Mock all dependencies
jest.mock('@/lib/supabase/server', () => ({
  checkRateLimit: jest.fn(),
  supabaseAdmin: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
  validateGameId: jest.fn(),
  validatePlayerId: jest.fn(),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

jest.mock('@/app/actions/gameInitActions', () => ({
  initializeGameAction: jest.fn(),
}))

import { revalidatePath } from 'next/cache'
import { initializeGameAction } from '@/app/actions/gameInitActions'
// Import mocked functions
import {
  checkRateLimit,
  supabaseAdmin,
  validateGameId,
  validatePlayerId,
} from '@/lib/supabase/server'

// Mock data creators
const createMockRoom = (): Omit<GameRoom, 'createdAt'> => ({
  id: 'room-1',
  name: 'Test Room',
  playerCount: 1,
  maxPlayers: 4,
  status: 'waiting',
  hostPlayerId: 'player-1',
})

const createMockRoomData = () => ({
  id: 'room-1',
  name: 'Test Room',
  player_count: 1,
  max_players: 4,
  status: 'waiting',
  host_player_id: 'player-1',
  created_at: new Date().toISOString(),
})

describe('Game Room Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation()
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('createGameRoomAction', () => {
    it('should create game room successfully', async () => {
      const room = createMockRoom()

      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: createMockRoomData(),
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await createGameRoomAction(room, 'player-1')

      expect(result.success).toBe(true)
      expect(result.gameRoom).toBeDefined()
      expect(result.gameRoom?.name).toBe('Test Room')
      expect(revalidatePath).toHaveBeenCalledWith('/rooms')
    })

    it('should return error when player ID invalid', async () => {
      const room = createMockRoom()

      ;(validatePlayerId as jest.Mock).mockReturnValue(false)

      const result = await createGameRoomAction(room, 'invalid')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid player ID')
    })

    it('should return error when host player ID mismatch', async () => {
      const room = createMockRoom()

      ;(validatePlayerId as jest.Mock).mockReturnValue(true)

      const result = await createGameRoomAction(room, 'player-2')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid host player ID')
    })

    it('should return error when rate limit exceeded', async () => {
      const room = createMockRoom()

      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(false)

      const result = await createGameRoomAction(room, 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Rate limit exceeded')
    })

    it('should return error when database insert fails', async () => {
      const room = createMockRoom()

      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await createGameRoomAction(room, 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to create game room')
    })
  })

  describe('getGameRoomsAction', () => {
    it('should get game rooms successfully without player ID', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [createMockRoomData()],
              error: null,
            }),
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await getGameRoomsAction()

      expect(result.success).toBe(true)
      expect(result.gameRooms).toHaveLength(1)
      expect(result.gameRooms?.[0].name).toBe('Test Room')
    })

    it('should get game rooms successfully with player ID', async () => {
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [createMockRoomData()],
              error: null,
            }),
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await getGameRoomsAction('player-1')

      expect(result.success).toBe(true)
      expect(result.gameRooms).toHaveLength(1)
    })

    it('should return error when player ID invalid', async () => {
      ;(validatePlayerId as jest.Mock).mockReturnValue(false)

      const result = await getGameRoomsAction('invalid')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid player ID')
    })

    it('should return error when database query fails', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await getGameRoomsAction()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to get game rooms')
    })
  })

  describe('joinGameRoomAction', () => {
    it('should join game room successfully', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                player_count: 2,
                max_players: 4,
                status: 'waiting',
              },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)
      ;(supabaseAdmin.rpc as jest.Mock).mockResolvedValue({ error: null })

      const result = await joinGameRoomAction('room-1', 'player-2')

      expect(result.success).toBe(true)
      expect(revalidatePath).toHaveBeenCalledWith('/rooms')
      expect(revalidatePath).toHaveBeenCalledWith('/rooms/room-1')
    })

    it('should return error when room ID invalid', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(false)

      const result = await joinGameRoomAction('invalid', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid room ID')
    })

    it('should return error when player ID invalid', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(false)

      const result = await joinGameRoomAction('room-1', 'invalid')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid player ID')
    })

    it('should return error when room is full', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                player_count: 4,
                max_players: 4,
                status: 'waiting',
              },
              error: null,
            }),
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await joinGameRoomAction('room-1', 'player-2')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Room is full')
    })

    it('should return error when room is not accepting players', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                player_count: 2,
                max_players: 4,
                status: 'playing',
              },
              error: null,
            }),
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await joinGameRoomAction('room-1', 'player-2')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Room is not accepting players')
    })
  })

  describe('setPlayerOnlineAction', () => {
    it('should set player online successfully', async () => {
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              error: null,
            }),
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await setPlayerOnlineAction('player-1')

      expect(result.success).toBe(true)
    })

    it('should return error when player ID invalid', async () => {
      ;(validatePlayerId as jest.Mock).mockReturnValue(false)

      const result = await setPlayerOnlineAction('invalid')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid player ID')
    })
  })

  describe('setPlayerOfflineAction', () => {
    it('should set player offline successfully', async () => {
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await setPlayerOfflineAction('player-1')

      expect(result.success).toBe(true)
    })

    it('should return error when player ID invalid', async () => {
      ;(validatePlayerId as jest.Mock).mockReturnValue(false)

      const result = await setPlayerOfflineAction('invalid')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid player ID')
    })
  })

  describe('invalidateSessionAction', () => {
    it('should invalidate session successfully', async () => {
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await invalidateSessionAction('player-1')

      expect(result.success).toBe(true)
    })

    it('should return error when player ID invalid', async () => {
      ;(validatePlayerId as jest.Mock).mockReturnValue(false)

      const result = await invalidateSessionAction('invalid')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid player ID')
    })
  })

  describe('refreshSessionAction', () => {
    it('should refresh session successfully', async () => {
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: {
              id: 'player-1',
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await refreshSessionAction('player-1')

      expect(result.success).toBe(true)
    })

    it('should return error when player ID invalid', async () => {
      ;(validatePlayerId as jest.Mock).mockReturnValue(false)

      const result = await refreshSessionAction('invalid')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid player ID')
    })
  })

  describe('leaveGameRoomAction', () => {
    it('should leave game room successfully', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: null,
            }),
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)
      ;(supabaseAdmin.rpc as jest.Mock).mockResolvedValue({ error: null })

      const result = await leaveGameRoomAction('room-1', 'player-1')

      expect(result.success).toBe(true)
      expect(revalidatePath).toHaveBeenCalledWith('/rooms')
    })

    it('should return error when room ID invalid', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(false)

      const result = await leaveGameRoomAction('invalid', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid room ID')
    })
  })

  describe('deleteGameRoomAction', () => {
    it('should delete game room successfully', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest
        .fn()
        .mockReturnValueOnce({
          // First call: select room
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { host_player_id: 'player-1', status: 'waiting' },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // Second call: update players
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: null,
            }),
          }),
        })
        .mockReturnValueOnce({
          // Third call: delete room
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: null,
            }),
          }),
        })

      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await deleteGameRoomAction('room-1', 'player-1')

      expect(result.success).toBe(true)
      expect(revalidatePath).toHaveBeenCalledWith('/rooms')
    })

    it('should return error when player is not the host', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { host_player_id: 'player-2', status: 'waiting' },
              error: null,
            }),
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await deleteGameRoomAction('room-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Only the host can delete the room')
    })
  })

  describe('getRoomDetailsAction', () => {
    it('should get room details successfully', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: createMockRoomData(),
              error: null,
            }),
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await getRoomDetailsAction('room-1')

      expect(result.success).toBe(true)
      expect(result.room).toBeDefined()
      expect(result.room?.name).toBe('Test Room')
    })

    it('should return error when room ID invalid', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(false)

      const result = await getRoomDetailsAction('invalid')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid room ID')
    })
  })

  describe('startGameFromRoomAction', () => {
    it('should start game from room successfully', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      // Mock Promise.all queries
      const mockFrom = jest
        .fn()
        .mockReturnValueOnce({
          // First call: room query (in Promise.all)
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  host_player_id: 'player-1',
                  player_count: 4,
                  max_players: 4,
                  status: 'waiting',
                },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // Second call: players query (in Promise.all)
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [
                    { id: 'p1', name: 'Player 1' },
                    { id: 'p2', name: 'Player 2' },
                    { id: 'p3', name: 'Player 3' },
                    { id: 'p4', name: 'Player 4' },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // Third call: update room status
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: null,
            }),
          }),
        })

      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)
      ;(initializeGameAction as jest.Mock).mockResolvedValue({
        success: true,
        data: { gameId: 'game-1', gameState: {} },
      })

      const result = await startGameFromRoomAction('room-1', 'player-1')

      expect(result.success).toBe(true)
      expect(initializeGameAction).toHaveBeenCalled()
    })

    it('should return error when player is not the host', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest
        .fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  host_player_id: 'player-2',
                  player_count: 4,
                  max_players: 4,
                  status: 'waiting',
                },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        })

      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await startGameFromRoomAction('room-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Only the host can start the game')
    })

    it('should return error when not enough players', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest
        .fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  host_player_id: 'player-1',
                  player_count: 2,
                  max_players: 4,
                  status: 'waiting',
                },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        })

      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await startGameFromRoomAction('room-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Need 4 players to start the game')
    })
  })
})
