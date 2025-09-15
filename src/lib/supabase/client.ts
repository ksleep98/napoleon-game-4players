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
  // パフォーマンス最適化設定
  global: {
    headers: {
      // Keep-alive接続を有効化
      Connection: 'keep-alive',
      // 圧縮を有効化
      'Accept-Encoding': 'gzip, deflate, br',
    },
  },
  // PostgREST設定最適化
  db: {
    schema: 'public',
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

  // テスト環境でのみRLS関数呼び出しをスキップ
  if (process.env.NODE_ENV === 'test') {
    console.log('Test mode: Skipping RLS setup')
    return
  }

  // 開発・本番問わずRLS設定を試行（セキュリティ担保のため）
  try {
    const { error } = await supabase.rpc('set_config', {
      setting_name: 'app.player_id',
      setting_value: playerId,
      is_local: true,
    })

    if (error) {
      // 関数が見つからない場合のハンドリング
      if (error.code === 'PGRST202') {
        console.warn(
          '⚠️  RLS set_config function not available. Please run the RLS policies in Supabase SQL Editor.',
          '\n   Game will continue but with reduced security in development.'
        )

        // 開発環境では警告して続行、本番環境では停止
        if (process.env.NODE_ENV === 'production') {
          throw new Error('RLS configuration required in production')
        }
        return
      }

      // その他のエラー
      console.error('RLS setup failed:', {
        code: error.code,
        message: error.message,
        details: error.details,
      })

      if (process.env.NODE_ENV === 'production') {
        throw new Error(`RLS setup failed: ${error.message}`)
      }
    } else {
      console.log('✅ RLS player session configured:', playerId)
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('RLS setup error:', errorMessage)

    if (process.env.NODE_ENV === 'production') {
      throw new Error(`RLS setup failed: ${errorMessage}`)
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
