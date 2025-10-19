import { defineConfig, devices } from '@playwright/test'

/**
 * Production E2E Test Configuration
 * 本番環境でのE2Eテスト設定
 */
export default defineConfig({
  testDir: './tests/e2e',

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? 'github' : 'html',

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ||
      'https://napoleon-game-production.vercel.app',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',

    /* Timeout for each action */
    actionTimeout: 15000,

    /* Timeout for each navigation */
    navigationTimeout: 30000,
  },

  /* Global timeout for each test */
  timeout: 60000,

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium-production',
      use: {
        ...devices['Desktop Chrome'],
        // Production環境では日本語UIでテスト
        locale: 'ja-JP',
        timezoneId: 'Asia/Tokyo',
      },
    },

    // Production環境ではChromeのみでテストを実行
    // 必要に応じて他のブラウザも追加可能
    // {
    //   name: 'firefox-production',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit-production',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /* 本番環境ではwebServerを使用しない（既にデプロイ済みのURLを使用） */
  // webServer: undefined,
})
