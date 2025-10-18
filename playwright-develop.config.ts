import { defineConfig, devices } from '@playwright/test'

/**
 * Develop環境専用のPlaywright設定
 * 外部URL（Vercel develop環境）に対してE2Eテストを実行
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // CI環境では順次実行
  forbidOnly: true,
  retries: 3, // develop環境では3回リトライ（ネットワーク不安定性を考慮）
  workers: 1, // CI環境では1ワーカー
  reporter: [
    ['line'],
    ['html', { open: 'never', outputFolder: 'playwright-report-develop' }],
    ['json', { outputFile: 'test-results/develop-results.json' }],
  ],

  use: {
    // 外部URLを使用（環境変数から設定）
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL || 'https://napoleon-game-dev.vercel.app',

    // 外部環境用の設定
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // 外部環境用のタイムアウト設定（通常より長め）
    actionTimeout: 45 * 1000, // 45秒
    navigationTimeout: 90 * 1000, // 90秒

    // 外部環境での安定性向上
    ignoreHTTPSErrors: true,

    // Vercel認証状態を読み込み（存在する場合）
    storageState: process.env.CI ? 'vercel-auth-state.json' : undefined,
  },

  timeout: 120 * 1000, // 120秒（外部環境用に延長）

  expect: {
    timeout: 30 * 1000, // 30秒
  },

  // CI環境用にChromiumのみ
  projects: [
    {
      name: 'chromium-develop',
      use: {
        ...devices['Desktop Chrome'],
        // 外部環境用のブラウザ設定
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security', // CORS問題回避
            '--disable-features=VizDisplayCompositor',
            '--ignore-certificate-errors', // SSL証明書エラー無視
          ],
        },
      },
    },
  ],

  // 外部環境を使用するためwebServerは無効
  webServer: undefined,

  // グローバル設定
  globalSetup: './tests/global-setup-develop.ts',
})
