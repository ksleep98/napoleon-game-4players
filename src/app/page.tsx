'use client'

import { useRouter } from 'next/navigation'
import { usePlayerSession } from '@/hooks/useSupabase'
import { AI_GAME_DEFAULTS, GAME_ID_PREFIXES } from '@/lib/constants'
import { FEATURE_FLAGS } from '@/lib/utils/environment'
import { generatePlayerId } from '@/utils/cardUtils'

export default function Home() {
  const router = useRouter()
  const { initializePlayer, isAuthenticated } = usePlayerSession()

  const handleStartGame = () => {
    router.push('/rooms')
  }

  const handleQuickGame = async () => {
    try {
      // AI対戦用のクイックスタート（人間1人 + AI 3人）
      const gameId = `${GAME_ID_PREFIXES.AI}${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)}`

      // Phase 5: httpOnlyクッキーでセッション保存（localStorage削除）
      // ⚠️ 固定IDを使うと全ユーザーが同じ playerId になり、
      //    互いのゲームを操作できてしまうため必ず一意なIDを生成する
      if (!isAuthenticated) {
        await initializePlayer(generatePlayerId(), AI_GAME_DEFAULTS.PLAYER_NAME)
      }

      router.push(`/game/${gameId}?ai=true`)
    } catch (error) {
      console.error('Failed to initialize player:', error)
      alert('Failed to start game. Please try again.')
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-800 via-green-700 to-green-900">
      <div className="container mx-auto px-4 py-16">
        {/* ヘッダー */}
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-white mb-6">Napoleon</h1>
          <h2 className="text-2xl text-green-200 mb-8">4-Player Card Game</h2>
          <p className="text-lg text-green-100 max-w-2xl mx-auto leading-relaxed">
            Experience the classic Napoleon card game online. Form teams,
            declare strategies, and compete to win the most tricks in this
            exciting 4-player card game.
          </p>
        </div>

        {/* メインコンテンツ */}
        <div className="max-w-4xl mx-auto">
          {/* ゲームの特徴 */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-green-800 bg-opacity-40 backdrop-blur-sm rounded-lg p-6 text-center">
              <div className="text-4xl mb-4">🎴</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Classic Napoleon
              </h3>
              <p className="text-green-100">
                Play the traditional Japanese card game with authentic rules and
                gameplay
              </p>
            </div>

            <div className="bg-green-800 bg-opacity-40 backdrop-blur-sm rounded-lg p-6 text-center">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                4-Player Online
              </h3>
              <p className="text-green-100">
                Join or create rooms to play with friends or other players
                online
              </p>
            </div>

            <div className="bg-green-800 bg-opacity-40 backdrop-blur-sm rounded-lg p-6 text-center">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Real-time Play
              </h3>
              <p className="text-green-100">
                Live gameplay with instant updates and smooth card animations
              </p>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="text-center space-y-6">
            <div className="space-x-6">
              {/* マルチプレイヤー機能：ローカル環境でのみ表示 */}
              {FEATURE_FLAGS.MULTIPLAYER_ROOMS && (
                <button
                  type="button"
                  onClick={handleStartGame}
                  className="inline-block bg-yellow-500 hover:bg-yellow-600 text-yellow-900 font-bold py-4 px-8 rounded-lg text-xl transition-colors shadow-lg cursor-pointer"
                >
                  Join Game Room
                </button>
              )}

              <button
                type="button"
                onClick={handleQuickGame}
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition-colors shadow-lg cursor-pointer"
              >
                Play vs AI
              </button>
            </div>

            <p className="text-green-100 text-sm">
              {FEATURE_FLAGS.MULTIPLAYER_ROOMS
                ? 'Join a room to play with others, or play against AI to practice'
                : 'Play against AI to practice your skills'}
            </p>
          </div>

          {/* ゲームルール */}
          <div className="mt-16 bg-green-800 bg-opacity-40 backdrop-blur-sm rounded-lg p-8">
            <h3 className="text-2xl font-bold text-white mb-6 text-center">
              How to Play
            </h3>

            <div className="grid md:grid-cols-2 gap-8 text-green-100">
              <div>
                <h4 className="font-semibold text-white mb-3">Game Setup</h4>
                <ul className="space-y-2 text-sm">
                  <li>• 4 players, 48 cards (52 cards minus four 2s)</li>
                  <li>• Each player gets 12 cards</li>
                  <li>• 4 cards remain hidden</li>
                  <li>• One player declares as Napoleon</li>
                  <li>• Napoleon chooses an adjutant</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-3">Objective</h4>
                <ul className="space-y-2 text-sm">
                  <li>• Napoleon + Adjutant team vs Allied Forces</li>
                  <li>• Napoleon team needs 8+ tricks to win</li>
                  <li>• Allied Forces win if Napoleon gets &lt;8 tricks</li>
                  <li>• Follow suit when possible</li>
                  <li>• Highest card of leading suit wins trick</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="text-center mt-16 text-green-300">
          <p className="text-sm">
            Built with Next.js, TypeScript, and Tailwind CSS
          </p>
        </div>
      </div>
    </main>
  )
}
