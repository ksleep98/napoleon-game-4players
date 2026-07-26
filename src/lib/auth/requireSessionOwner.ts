/**
 * Server Action 認可ユーティリティ
 *
 * 重要な設計:
 * - 「操作主体（actor）」は httpOnly クッキーのセッションからのみ決定する。
 *   クライアントが渡す playerId は「操作対象（target）」でしかなく、
 *   認証情報として一切信頼しない。
 * - COM（AI）プレイヤーはクッキーを持たないため、AI のターンは
 *   「同じゲームに参加している人間プレイヤーのセッション」が代理で進める。
 *   その場合のみ actor !== target を許可する。
 *
 * - セッションはスライディング期限。認可が成功するたびに
 *   `extendSessionIfNeeded()` がクッキーの有効期限を延長する
 *   （毎回ではなく、前回発行から一定時間が経過した場合のみ）。
 *
 * 注意: `getSessionCookie()` は Next.js のリクエストスコープ外
 * （headless スクリプト等）では内部で例外を捕捉して null を返す。
 * つまりリクエスト外からこのモジュールを使うと必ず UNAUTHORIZED になる。
 * サーバー内部処理／シミュレータは Server Action ではなく
 * `src/lib/` 配下の内部関数を直接呼ぶこと。
 */

import { AUTH_ERRORS } from '@/lib/constants'
import {
  getSessionCookie,
  isSessionValid,
  refreshSession,
  type SessionCookieData,
  setSessionCookie,
  shouldExtendSession,
} from '@/lib/cookies/sessionCookies'
import {
  GAME_ACTION_ERROR_CODES,
  GameActionError,
} from '@/lib/errors/GameActionError'
import type { GameState } from '@/types/game'

/**
 * セッションクッキーの有効期限を延長する（スライディング期限・ベストエフォート）
 *
 * ⚠️ `cookies().set()` は Server Action / Route Handler の中でしか呼べない。
 * レンダリング中やリクエストスコープ外（headless シミュレータ等）から
 * 呼ばれた場合は例外になるが、**延長できなくても認可は成功させる**。
 * したがってここでは例外を握りつぶし、呼び出し元へ伝播させない。
 */
async function extendSessionIfNeeded(
  session: SessionCookieData
): Promise<void> {
  try {
    if (!shouldExtendSession(session)) {
      return
    }

    await setSessionCookie(refreshSession(session))
  } catch (error) {
    // 延長失敗は認可の失敗ではない（期限内のセッションはそのまま有効）
    console.warn('[Auth] Failed to extend session cookie:', error)
  }
}

/**
 * 認証済みの操作主体 playerId を取得する（未認証なら null）
 *
 * 認可が成功したタイミングでセッションの有効期限を延長する（スライディング期限）。
 * 全 Server Action がこの関数を通るため、操作し続けている限り失効しない。
 */
export async function getAuthenticatedPlayerId(): Promise<string | null> {
  const session = await getSessionCookie()

  if (!session?.playerId) {
    return null
  }

  if (!isSessionValid(session)) {
    return null
  }

  await extendSessionIfNeeded(session)

  return session.playerId
}

/**
 * 認証必須。未認証なら UNAUTHORIZED を投げる
 */
export async function requireAuthenticatedPlayerId(): Promise<string> {
  const actorId = await getAuthenticatedPlayerId()

  if (!actorId) {
    throw new GameActionError(
      AUTH_ERRORS.SESSION_REQUIRED,
      GAME_ACTION_ERROR_CODES.UNAUTHORIZED
    )
  }

  return actorId
}

/**
 * 「クッキーの playerId」と「引数の playerId」の一致を強制する
 * @returns 検証済みの actor playerId
 */
export async function requireSessionOwner(playerId: string): Promise<string> {
  const actorId = await requireAuthenticatedPlayerId()

  if (actorId !== playerId) {
    throw new GameActionError(
      AUTH_ERRORS.FORBIDDEN_PLAYER,
      GAME_ACTION_ERROR_CODES.FORBIDDEN
    )
  }

  return actorId
}

/**
 * actor がそのゲームの人間プレイヤーとして参加していることを保証する
 */
export function assertGameParticipant(
  gameState: GameState,
  actorId: string
): void {
  const actor = gameState.players.find((p) => p.id === actorId)

  if (!actor || actor.isAI) {
    throw new GameActionError(
      AUTH_ERRORS.NOT_A_PARTICIPANT,
      GAME_ACTION_ERROR_CODES.FORBIDDEN
    )
  }
}

/**
 * actor が target playerId として操作してよいかを検証する
 * - 自分自身の操作は常に許可
 * - 同一ゲーム内の AI プレイヤーの代理操作のみ追加で許可
 */
export function assertCanActAsPlayer(
  gameState: GameState,
  actorId: string,
  targetPlayerId: string
): void {
  assertGameParticipant(gameState, actorId)

  if (actorId === targetPlayerId) {
    return
  }

  const target = gameState.players.find((p) => p.id === targetPlayerId)

  // 代理操作は「同じゲームの AI プレイヤー」に対してのみ許可する
  if (!target?.isAI) {
    throw new GameActionError(
      AUTH_ERRORS.FORBIDDEN_PLAYER,
      GAME_ACTION_ERROR_CODES.FORBIDDEN
    )
  }
}
