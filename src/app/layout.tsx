import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Napoleon Game (4 Players)',
  description: 'A web-based Napoleon card game for 4 players',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
