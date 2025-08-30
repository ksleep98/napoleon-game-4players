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
