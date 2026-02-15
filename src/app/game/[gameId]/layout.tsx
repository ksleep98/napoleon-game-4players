export const runtime = 'nodejs'

interface GameLayoutProps {
  children: React.ReactNode
}

export default function GameLayout({ children }: GameLayoutProps) {
  return <>{children}</>
}
