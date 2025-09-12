import { defineConfig, devices } from '@playwright/test'

// CI専用のPlaywright設定
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // CI環境では順次実行
  forbidOnly: true,
  retries: 2, // CI環境では2回リトライ
  workers: 1, // CI環境では1ワーカー
  reporter: [['line'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // CI環境用のタイムアウト設定
    actionTimeout: 30 * 1000,
    navigationTimeout: 60 * 1000,
  },

  timeout: 90 * 1000, // 90秒

  expect: {
    timeout: 20 * 1000,
  },

  // CI環境用にChromiumのみ
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // ヘッドレスモードを明示
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ],
        },
      },
    },
  ],

  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: false, // CI環境では常に新しいサーバー
        timeout: 180 * 1000, // 3分
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          NODE_ENV: 'test',
          NEXT_TELEMETRY_DISABLED: '1',
          PORT: '3000',
        },
      },
})
