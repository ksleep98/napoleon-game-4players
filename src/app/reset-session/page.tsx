'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { usePlayerSession } from '@/hooks/useSupabase'

export default function ResetSessionPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'resetting' | 'done'>('idle')

  // Phase 5: httpOnlyクッキーのセッションのみを信頼する（localStorage廃止）
  const { playerName, isAuthenticated, clearPlayer } = usePlayerSession()

  const handleReset = async () => {
    setStatus('resetting')

    try {
      // httpOnlyクッキーのセッションを破棄（localStorageには何も保持していない）
      await clearPlayer()
    } catch (error) {
      console.error('Failed to clear session:', error)
    }

    setStatus('done')
  }

  const handleGoHome = () => {
    router.push('/')
  }

  const handleGoRooms = () => {
    router.push('/rooms')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              🔄 セッションリセット
            </h1>
            <p className="text-gray-600">
              プレイヤーセッションをクリアして新しくスタートします
            </p>
          </div>

          {/* Current Session Info */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              現在のセッション情報
            </h2>
            {isAuthenticated ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">👤 プレイヤー名:</span>
                  <code className="bg-blue-100 text-blue-800 px-3 py-1 rounded">
                    {playerName ?? '(未設定)'}
                  </code>
                </div>
                {/* F-2: プレイヤーIDは画面に描画しない */}
              </div>
            ) : (
              <p className="text-gray-500 italic">
                セッション情報が見つかりません
              </p>
            )}
          </div>

          {/* Status Messages */}
          {status === 'resetting' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 animate-pulse">
              <p className="text-yellow-800 text-center font-medium">
                🔄 セッションをリセット中...
              </p>
            </div>
          )}

          {status === 'done' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-800 text-center font-medium">
                ✅ セッションがリセットされました！
              </p>
              <p className="text-green-700 text-sm text-center mt-2">
                新しいプレイヤーIDでゲームを開始できます
              </p>
            </div>
          )}

          {/* Reset Warning */}
          {status === 'idle' && isAuthenticated && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-amber-800 mb-2">⚠️ 注意事項</h3>
              <ul className="text-amber-700 text-sm space-y-1 list-disc list-inside">
                <li>保存されたプレイヤー情報が削除されます</li>
                <li>参加中のルームから自動的に退出されます</li>
                <li>ホストの場合、ルームは保持されますが再参加が必要です</li>
                <li>リセット後は新しいプレイヤーIDが発行されます</li>
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {status === 'idle' && (
              <button
                type="button"
                onClick={handleReset}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-lg transition-colors shadow-md hover:shadow-lg cursor-pointer"
              >
                🗑️ セッションをリセット
              </button>
            )}

            {status === 'done' && (
              <>
                <button
                  type="button"
                  onClick={handleGoRooms}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-colors shadow-md hover:shadow-lg cursor-pointer"
                >
                  🎮 ルーム一覧へ
                </button>
                <button
                  type="button"
                  onClick={handleGoHome}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-4 px-6 rounded-lg transition-colors cursor-pointer"
                >
                  🏠 ホームへ
                </button>
              </>
            )}

            {status === 'idle' && (
              <button
                type="button"
                onClick={handleGoHome}
                className="w-full bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors cursor-pointer"
              >
                ← キャンセル
              </button>
            )}
          </div>

          {/* Info Section */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="font-semibold text-gray-700 mb-3">
              💡 セッションリセットが必要な場合
            </h3>
            <ul className="text-gray-600 text-sm space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-500">•</span>
                <span>
                  ホストとして再参加したいが、Start Gameボタンが表示されない
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500">•</span>
                <span>「Player session not found」エラーが発生している</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500">•</span>
                <span>別のプレイヤーIDで新しくゲームを開始したい</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500">•</span>
                <span>開発・テスト目的でセッションをクリーンアップしたい</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-gray-500 text-sm">
          <p>Napoleon Game - Session Management</p>
        </div>
      </div>
    </div>
  )
}
