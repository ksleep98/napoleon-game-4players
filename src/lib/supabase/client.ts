import { createClient } from '@supabase/supabase-js'
import type { GameState, PlayerScore } from '@/types/game'
import { getSecurePlayerName, setSecurePlayer } from '@/utils/secureStorage'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co'
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock_anon_key'

// Only throw error in production runtime (not during build)
if (
  typeof window !== 'undefined' &&
  (!process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
) {
  console.warn('Missing Supabase environment variables - using mock values')
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
})

// プレイヤーIDをセッションに設定するヘルパー関数（セキュア版）
export const setPlayerSession = async (playerId: string): Promise<void> => {
  // セキュアストレージに保存
  if (typeof window !== 'undefined') {
    try {
      // プレイヤー名は別途設定する必要があるため、既存の名前を取得または匿名設定
      const currentName = getSecurePlayerName() || 'Anonymous'
      setSecurePlayer(playerId, currentName)
    } catch (error) {
      console.warn('Failed to use secure storage:', error)
    }
  }

  // テスト環境でのみ RLS 関数呼び出しをスキップ
  // 開発環境では実際のRLS設定を試行する
  if (process.env.NODE_ENV === 'test') {
    console.log('Test mode: Skipping RLS setup')
    return
  }

  try {
    const { error } = await supabase.rpc('set_config', {
      setting_name: 'app.player_id',
      setting_value: playerId,
      is_local: true,
    })

    if (error) {
      console.warn('Failed to set player session:', error)
      // 開発環境ではRLS関数が存在しない場合があるので警告のみ
      if (process.env.NODE_ENV === 'production') {
        throw error
      }
    }
  } catch (err) {
    console.warn('Failed to set player session:', err)
    // 開発環境ではRLS関数が存在しない場合があるので警告のみ
    if (process.env.NODE_ENV === 'production') {
      throw err
    }
  }
}

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
