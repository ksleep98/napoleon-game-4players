// エラーコード定数
export const GAME_ACTION_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_STATE: 'INVALID_STATE',
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_GAME_ID: 'INVALID_GAME_ID',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SAVE_FAILED: 'SAVE_FAILED',
  FORBIDDEN: 'FORBIDDEN',
} as const

// カスタムエラー型（サーバーアクション用）
export class GameActionError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message)
    this.name = 'GameActionError'
  }
}
