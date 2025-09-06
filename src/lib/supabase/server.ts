import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL. Please check your .env.local file.'
  )
}

// サーバーサイド専用クライアント（Service Role Key使用）
// RLSポリシーをバイパスし、サーバーサイドで認証を管理
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey || supabaseAnonKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: supabaseServiceRoleKey
        ? {
            Authorization: `Bearer ${supabaseServiceRoleKey}`,
          }
        : {},
    },
  }
)

// Service Role Key の可用性をチェック
export const hasServiceRoleKey = !!supabaseServiceRoleKey
// Service Role Key設定の詳細診断
export const diagnoseServiceRoleKey = () => {
  const keyExists = !!supabaseServiceRoleKey
  const keyLength = supabaseServiceRoleKey?.length || 0
  const keyPrefix = supabaseServiceRoleKey?.substring(0, 15) || 'N/A'

  // 新しいAPI Keys形式の判定
  const isNewApiKey = supabaseServiceRoleKey?.startsWith('sb_secret_')
  const isLegacyJWT = supabaseServiceRoleKey?.startsWith('eyJ')

  return {
    exists: keyExists,
    length: keyLength,
    prefix: keyPrefix,
    isNewApiKey,
    isLegacyJWT,
    isValid: keyExists && (isNewApiKey || isLegacyJWT),
    keyType: isNewApiKey
      ? 'new_secret_key'
      : isLegacyJWT
        ? 'legacy_jwt'
        : 'unknown',
    usingAnonFallback: !keyExists,
  }
}

// 開発環境での診断情報
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 Supabase Configuration:')
  console.log('- URL:', supabaseUrl ? '✅ Set' : '❌ Missing')
  console.log('- Anon Key:', supabaseAnonKey ? '✅ Set' : '❌ Missing')
  console.log(
    '- Service Role Key:',
    supabaseServiceRoleKey ? '✅ Set' : '❌ Missing'
  )

  if (!supabaseServiceRoleKey) {
    console.warn(
      '⚠️  SUPABASE_SERVICE_ROLE_KEY not found. Server actions will use anon key and may face RLS restrictions.'
    )
  }
}

/**
 * プレイヤーIDを検証する関数
 * 実際の認証システムではJWTトークンやセッション検証を行う
 */
export function validatePlayerId(playerId: string): boolean {
  // 開発環境では簡易的な検証
  // 本番環境では適切な認証システムと連携
  if (!playerId || typeof playerId !== 'string') {
    return false
  }

  // プレイヤーIDの基本的な形式チェック
  const playerIdRegex = /^[a-zA-Z0-9_-]+$/
  return (
    playerIdRegex.test(playerId) &&
    playerId.length > 0 &&
    playerId.length <= 255
  )
}

/**
 * ゲームIDを検証する関数
 */
export function validateGameId(gameId: string): boolean {
  if (!gameId || typeof gameId !== 'string') {
    return false
  }

  // ゲームIDの基本的な形式チェック
  const gameIdRegex = /^[a-zA-Z0-9_-]+$/
  return gameIdRegex.test(gameId) && gameId.length > 0 && gameId.length <= 255
}

/**
 * リクエストレート制限（簡易版）
 */
const requestMap = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  identifier: string,
  maxRequests = 100,
  windowMs = 60000
): boolean {
  const now = Date.now()
  const userRequests = requestMap.get(identifier)

  if (!userRequests || now > userRequests.resetTime) {
    requestMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (userRequests.count >= maxRequests) {
    return false
  }

  userRequests.count++
  return true
}
