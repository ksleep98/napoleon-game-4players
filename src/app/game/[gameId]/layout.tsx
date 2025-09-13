export const runtime = 'edge'

interface GameLayoutProps {
  children: React.ReactNode
}

export default function GameLayout({ children }: GameLayoutProps) {
  return <>{children}</>
}
