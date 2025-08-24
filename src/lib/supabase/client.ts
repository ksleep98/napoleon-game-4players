import { createClient } from '@supabase/supabase-js'
import type { GameState } from '@/types/game'

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
          tricks_won: number
          scores: unknown // JSON array of PlayerScore
          created_at: string
        }
        Insert: {
          id?: string
          game_id: string
          napoleon_won: boolean
          napoleon_player_id: string
          adjutant_player_id?: string | null
          tricks_won: number
          scores: unknown
          created_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          napoleon_won?: boolean
          napoleon_player_id?: string
          adjutant_player_id?: string | null
          tricks_won?: number
          scores?: unknown
          created_at?: string
        }
      }
    }
  }
}
