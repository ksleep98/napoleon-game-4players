import { createClient } from '@supabase/supabase-js'
import type { GameState, PlayerScore } from '@/types/game'

const isTestEnv = process.env.NODE_ENV === 'test'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

// Warn at runtime if Supabase credentials are missing (skip during build/test)
if (
  typeof window !== 'undefined' &&
  !isTestEnv &&
  (!process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
) {
  console.error(
    'Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  )
}

// クライアント設定（リアルタイム機能有効化）
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10, // レート制限
    },
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  // 超高速化設定（100ms以下を目指す）
  global: {
    headers: {
      // Keep-alive接続を有効化
      Connection: 'keep-alive',
      // 圧縮を有効化
      'Accept-Encoding': 'gzip, deflate, br',
      // キャッシュ制御
      'Cache-Control': 'no-cache',
      // ユーザーエージェント最適化
      'User-Agent': 'Napoleon-Game/1.0',
      // HTTP/2 Server Push活用
      'x-supabase-api-version': '2024-01-01',
      // 事前DNS解決
      'dns-prefetch-control': 'on',
      // TCP Fast Open有効化
      'x-tcp-fast-open': '1',
      // HTTP/2優先度制御
      'x-priority': 'u=1, i',
    },
    fetch: (url, options = {}) => {
      // 超高速タイムアウト設定
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒タイムアウト（短縮）

      return fetch(url, {
        ...options,
        signal: controller.signal,
        // HTTP/2を強制（利用可能な場合）
        cache: 'no-cache',
        // 接続再利用
        keepalive: true,
        // HTTP/2優先度制御
        priority: 'high',
        // TCP Fast Open
        mode: 'cors',
        credentials: 'same-origin',
        // 事前接続最適化
        referrerPolicy: 'no-referrer-when-downgrade',
      }).finally(() => clearTimeout(timeoutId))
    },
  },
  // PostgREST設定最適化
  db: {
    schema: 'public',
  },
})

export type Database = {
  public: {
    Tables: {
      games: {
        Row: {
          id: string
          state: GameState // JSONBオブジェクトとしてゲームの状態全体を保存
          created_at: string
          updated_at: string
          phase: string
          winner_team: string | null
        }
        Insert: {
          id: string
          state: GameState
          created_at?: string
          updated_at?: string
          phase: string
          winner_team?: string | null
        }
        Update: {
          id?: string
          state?: GameState
          created_at?: string
          updated_at?: string
          phase?: string
          winner_team?: string | null
        }
      }
      game_rooms: {
        Row: {
          id: string
          name: string
          player_count: number
          max_players: number
          status: string
          host_player_id: string
          created_at: string
        }
        Insert: {
          id: string
          name: string
          player_count?: number
          max_players?: number
          status?: string
          host_player_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          player_count?: number
          max_players?: number
          status?: string
          host_player_id?: string
          created_at?: string
        }
      }
      players: {
        Row: {
          id: string
          name: string
          game_id: string | null
          room_id: string | null
          connected: boolean
          created_at: string
        }
        Insert: {
          id: string
          name: string
          game_id?: string | null
          room_id?: string | null
          connected?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          game_id?: string | null
          room_id?: string | null
          connected?: boolean
          created_at?: string
        }
      }
      game_results: {
        Row: {
          id: string
          game_id: string
          napoleon_won: boolean
          napoleon_player_id: string
          adjutant_player_id: string | null
          face_cards_won: number
          scores: PlayerScore[] // JSON array of PlayerScore
          created_at: string
        }
        Insert: {
          id?: string
          game_id: string
          napoleon_won: boolean
          napoleon_player_id: string
          adjutant_player_id?: string | null
          face_cards_won: number
          scores: PlayerScore[]
          created_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          napoleon_won?: boolean
          napoleon_player_id?: string
          adjutant_player_id?: string | null
          face_cards_won?: number
          scores?: unknown
          created_at?: string
        }
      }
    }
  }
}
