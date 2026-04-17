/**
 * Tests for GameActionError class
 */

import {
  GAME_ACTION_ERROR_CODES,
  GameActionError,
} from '@/lib/errors/GameActionError'

describe('GameActionError', () => {
  it('should create error with message', () => {
    const error = new GameActionError('Test error message')

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(GameActionError)
    expect(error.message).toBe('Test error message')
    expect(error.name).toBe('GameActionError')
  })

  it('should create error with message and code', () => {
    const error = new GameActionError('Unauthorized access', 'UNAUTHORIZED')

    expect(error.message).toBe('Unauthorized access')
    expect(error.code).toBe('UNAUTHORIZED')
  })

  it('should support all error codes from GAME_ACTION_ERROR_CODES', () => {
    const error = new GameActionError(
      'Database error',
      GAME_ACTION_ERROR_CODES.DATABASE_ERROR
    )

    expect(error.code).toBe('DATABASE_ERROR')
    expect(error.message).toBe('Database error')
  })

  it('should be throwable', () => {
    expect(() => {
      throw new GameActionError('Test error', 'TEST_CODE')
    }).toThrow(GameActionError)
  })

  it('should be catchable', () => {
    try {
      throw new GameActionError('Test error', 'TEST_CODE')
    } catch (error) {
      expect(error).toBeInstanceOf(GameActionError)
      if (error instanceof GameActionError) {
        expect(error.code).toBe('TEST_CODE')
      }
    }
  })

  it('should preserve stack trace', () => {
    const error = new GameActionError('Test error')

    expect(error.stack).toBeDefined()
    expect(error.stack).toContain('GameActionError.test.ts')
  })
})

describe('GAME_ACTION_ERROR_CODES', () => {
  it('should have all expected error codes', () => {
    expect(GAME_ACTION_ERROR_CODES).toEqual({
      UNAUTHORIZED: 'UNAUTHORIZED',
      NOT_FOUND: 'NOT_FOUND',
      INVALID_STATE: 'INVALID_STATE',
      INVALID_INPUT: 'INVALID_INPUT',
      INVALID_GAME_ID: 'INVALID_GAME_ID',
      RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
      DATABASE_ERROR: 'DATABASE_ERROR',
      SAVE_FAILED: 'SAVE_FAILED',
      FORBIDDEN: 'FORBIDDEN',
    })
  })

  it('should have consistent values', () => {
    // Each code should equal its key name
    Object.entries(GAME_ACTION_ERROR_CODES).forEach(([key, value]) => {
      expect(value).toBe(key)
    })
  })
})
