/**
 * SessionMigrationProvider コンポーネントテスト
 */

import { render, screen, waitFor } from '@testing-library/react'
import { SessionMigrationProvider } from '@/components/providers/SessionMigrationProvider'
import * as useSessionMigrationModule from '@/hooks/useSessionMigration'

// useSessionMigrationのモック
jest.mock('@/hooks/useSessionMigration')

describe('SessionMigrationProvider', () => {
  const mockUseSessionMigration =
    useSessionMigrationModule.useSessionMigration as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Migration States', () => {
    it('should show loading state while migrating', () => {
      mockUseSessionMigration.mockReturnValue({
        migrated: false,
        migrating: true,
        error: null,
      })

      render(
        <SessionMigrationProvider>
          <div>App Content</div>
        </SessionMigrationProvider>
      )

      // ローディング表示を確認
      expect(screen.getByText(/Migrating session/i)).toBeInTheDocument()
      expect(
        screen.getByText(/Upgrading security \(XSS protection\)/i)
      ).toBeInTheDocument()

      // 子コンポーネントは表示されない
      expect(screen.queryByText('App Content')).not.toBeInTheDocument()
    })

    it('should render children after successful migration', () => {
      mockUseSessionMigration.mockReturnValue({
        migrated: true,
        migrating: false,
        error: null,
      })

      render(
        <SessionMigrationProvider>
          <div>App Content</div>
        </SessionMigrationProvider>
      )

      // 子コンポーネントが表示される
      expect(screen.getByText('App Content')).toBeInTheDocument()

      // ローディング表示はない
      expect(screen.queryByText(/Migrating session/i)).not.toBeInTheDocument()
    })

    it('should render children when no migration needed', () => {
      mockUseSessionMigration.mockReturnValue({
        migrated: true,
        migrating: false,
        error: null,
      })

      render(
        <SessionMigrationProvider>
          <div>No Migration Needed</div>
        </SessionMigrationProvider>
      )

      expect(screen.getByText('No Migration Needed')).toBeInTheDocument()
    })

    it('should render children even with migration error', () => {
      // エラーがあっても続行（フォールバック）
      mockUseSessionMigration.mockReturnValue({
        migrated: false,
        migrating: false,
        error: 'Migration failed',
      })

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      render(
        <SessionMigrationProvider>
          <div>App with Error</div>
        </SessionMigrationProvider>
      )

      // 子コンポーネントは表示される（ユーザー体験を損なわない）
      expect(screen.getByText('App with Error')).toBeInTheDocument()

      // 警告がコンソールに出力される
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[SessionMigration] Migration failed, continuing:',
        'Migration failed'
      )

      consoleWarnSpy.mockRestore()
    })
  })

  describe('Loading UI', () => {
    it('should display spinner during migration', () => {
      mockUseSessionMigration.mockReturnValue({
        migrated: false,
        migrating: true,
        error: null,
      })

      const { container } = render(
        <SessionMigrationProvider>
          <div>Content</div>
        </SessionMigrationProvider>
      )

      // スピナー要素を確認
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('should have correct styling for loading state', () => {
      mockUseSessionMigration.mockReturnValue({
        migrated: false,
        migrating: true,
        error: null,
      })

      const { container } = render(
        <SessionMigrationProvider>
          <div>Content</div>
        </SessionMigrationProvider>
      )

      // 背景グラデーション
      const loadingContainer = container.querySelector(
        '.bg-gradient-to-br.from-blue-900.to-purple-900'
      )
      expect(loadingContainer).toBeInTheDocument()

      // フルスクリーン
      expect(loadingContainer).toHaveClass('min-h-screen')
    })
  })

  describe('State Transitions', () => {
    it('should transition from loading to content', async () => {
      let migrationState = {
        migrated: false,
        migrating: true,
        error: null,
      }

      mockUseSessionMigration.mockImplementation(() => migrationState)

      const { rerender } = render(
        <SessionMigrationProvider>
          <div>App Content</div>
        </SessionMigrationProvider>
      )

      // 初期状態: ローディング
      expect(screen.getByText(/Migrating session/i)).toBeInTheDocument()

      // 状態変更: 移行完了
      migrationState = {
        migrated: true,
        migrating: false,
        error: null,
      }

      rerender(
        <SessionMigrationProvider>
          <div>App Content</div>
        </SessionMigrationProvider>
      )

      // コンテンツが表示される
      await waitFor(() => {
        expect(screen.getByText('App Content')).toBeInTheDocument()
      })
    })
  })

  describe('Children Rendering', () => {
    it('should render multiple children', () => {
      mockUseSessionMigration.mockReturnValue({
        migrated: true,
        migrating: false,
        error: null,
      })

      render(
        <SessionMigrationProvider>
          <div>Child 1</div>
          <div>Child 2</div>
          <div>Child 3</div>
        </SessionMigrationProvider>
      )

      expect(screen.getByText('Child 1')).toBeInTheDocument()
      expect(screen.getByText('Child 2')).toBeInTheDocument()
      expect(screen.getByText('Child 3')).toBeInTheDocument()
    })

    it('should render complex children', () => {
      mockUseSessionMigration.mockReturnValue({
        migrated: true,
        migrating: false,
        error: null,
      })

      render(
        <SessionMigrationProvider>
          <div>
            <header>Header</header>
            <main>Main Content</main>
            <footer>Footer</footer>
          </div>
        </SessionMigrationProvider>
      )

      expect(screen.getByText('Header')).toBeInTheDocument()
      expect(screen.getByText('Main Content')).toBeInTheDocument()
      expect(screen.getByText('Footer')).toBeInTheDocument()
    })
  })
})
