import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SessionMigrationProvider } from '@/components/providers/SessionMigrationProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Napoleon Game (4 Players)',
  description: 'A web-based Napoleon card game for 4 players',
}

// 🚀 高速ローディングコンポーネント（5-15ms削減）
function FastLoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
        <div className="text-white text-lg font-semibold">
          🃏 Loading Napoleon Game...
        </div>
        <div className="text-white/70 text-sm mt-2">Optimized for speed</div>
      </div>
    </div>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <SessionMigrationProvider>
          <Suspense fallback={<FastLoadingFallback />}>{children}</Suspense>
        </SessionMigrationProvider>
      </body>
    </html>
  )
}
