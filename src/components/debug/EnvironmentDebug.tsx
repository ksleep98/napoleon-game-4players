'use client'

/**
 * Environment Debug Component
 * 環境・フィーチャーフラグの確認用デバッグコンポーネント
 */

import { useState } from 'react'
import {
  debugEnvironment,
  FEATURE_FLAGS,
  getEnvironmentInfo,
} from '@/lib/utils/environment'

export function EnvironmentDebug() {
  const [isVisible, setIsVisible] = useState(false)
  const envInfo = getEnvironmentInfo()

  // 開発環境またはパフォーマンス監視が有効な場合のみ表示
  if (
    process.env.NODE_ENV !== 'development' &&
    process.env.NEXT_PUBLIC_ENABLE_PERF_MONITOR !== 'true'
  ) {
    return null
  }

  return (
    <>
      {/* トグルボタン */}
      <button
        type="button"
        onClick={() => {
          setIsVisible(!isVisible)
          if (!isVisible) {
            debugEnvironment()
          }
        }}
        className="fixed bottom-4 right-4 z-50 bg-purple-600 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-mono hover:bg-purple-700 transition-colors"
        style={{ fontSize: '11px' }}
      >
        🌍 Env
      </button>

      {/* デバッグパネル */}
      {isVisible && (
        <div className="fixed bottom-16 right-4 z-40 bg-white border border-purple-300 rounded-lg shadow-xl p-4 max-w-sm w-80 max-h-80 overflow-y-auto">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-purple-800 mb-2">
              🌍 Environment Debug
            </h3>

            {/* 環境情報 */}
            <div className="space-y-3 text-sm">
              <div className="bg-purple-50 p-3 rounded">
                <div className="font-semibold text-purple-800 mb-2">
                  Environment Info
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Environment:</span>
                    <code className="bg-purple-100 px-1 rounded">
                      {envInfo.environment}
                    </code>
                  </div>
                  <div className="flex justify-between">
                    <span>Hostname:</span>
                    <code className="bg-purple-100 px-1 rounded text-xs">
                      {envInfo.hostname}
                    </code>
                  </div>
                  <div className="flex justify-between">
                    <span>Production:</span>
                    <span
                      className={
                        envInfo.isProduction ? 'text-red-600' : 'text-green-600'
                      }
                    >
                      {envInfo.isProduction ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Build:</span>
                    <code className="bg-purple-100 px-1 rounded text-xs">
                      {envInfo.commitRef}
                    </code>
                  </div>
                </div>
              </div>

              {/* フィーチャーフラグ */}
              <div className="bg-gray-50 p-3 rounded">
                <div className="font-semibold text-gray-800 mb-2">
                  Feature Flags
                </div>
                <div className="space-y-1 text-xs">
                  {(
                    [
                      ['MULTIPLAYER_ROOMS', FEATURE_FLAGS.MULTIPLAYER_ROOMS],
                      [
                        'PERFORMANCE_MONITORING',
                        FEATURE_FLAGS.PERFORMANCE_MONITORING,
                      ],
                      ['DEBUG_TOOLS', FEATURE_FLAGS.DEBUG_TOOLS],
                      ['VERBOSE_LOGGING', FEATURE_FLAGS.VERBOSE_LOGGING],
                      [
                        'EXPERIMENTAL_FEATURES',
                        FEATURE_FLAGS.EXPERIMENTAL_FEATURES,
                      ],
                    ] as const
                  ).map(([feature, enabled]) => (
                    <div
                      key={feature}
                      className="flex justify-between items-center"
                    >
                      <span className="text-gray-700">
                        {feature.replace(/_/g, ' ').toLowerCase()}:
                      </span>
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          enabled ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        title={enabled ? 'Enabled' : 'Disabled'}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 有効な機能一覧 */}
              {envInfo.enabledFeatures.length > 0 && (
                <div className="bg-green-50 p-3 rounded">
                  <div className="font-semibold text-green-800 mb-2">
                    Enabled Features
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {envInfo.enabledFeatures.map((feature) => (
                      <span
                        key={feature}
                        className="inline-block px-2 py-1 bg-green-100 text-green-700 rounded text-xs"
                      >
                        {feature.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* テストボタン */}
              <div className="flex space-x-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    console.log('🌍 Environment Info:', envInfo)
                    console.log('🎛️ Feature Flags:', FEATURE_FLAGS)
                  }}
                  className="flex-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
                >
                  Log to Console
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const info = `Environment: ${envInfo.environment}\nMultiplayer: ${FEATURE_FLAGS.MULTIPLAYER_ROOMS ? 'ON' : 'OFF'}\nPerformance: ${FEATURE_FLAGS.PERFORMANCE_MONITORING ? 'ON' : 'OFF'}`
                    alert(info)
                  }}
                  className="flex-1 px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                >
                  Show Alert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
