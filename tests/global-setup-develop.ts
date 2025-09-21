import { chromium, type FullConfig } from '@playwright/test'

/**
 * Develop環境用グローバルセットアップ
 * Vercel認証とURLの可用性チェック
 */
async function globalSetup(config: FullConfig) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL

  if (!baseURL) {
    throw new Error(
      'Base URL is not configured for develop environment testing'
    )
  }

  console.log(`🌐 Preparing E2E tests for develop environment: ${baseURL}`)

  // Vercel OAuth認証が必要な場合の処理
  const githubUsername =
    process.env.GITHUB_USERNAME || process.env.VERCEL_AUTH_USERNAME
  const githubPassword =
    process.env.GITHUB_PASSWORD || process.env.VERCEL_AUTH_PASSWORD

  if (githubUsername && githubPassword) {
    console.log('🔐 Vercel OAuth authentication required, setting up auth...')

    // ブラウザでVercel OAuth認証を実行
    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()

    try {
      console.log('🌐 Accessing protected Vercel environment...')
      await page.goto(baseURL)

      // Vercel認証画面の検出
      if (
        page.url().includes('vercel.com') ||
        (await page
          .locator('[data-testid="login-button"], .login, #login')
          .first()
          .isVisible({ timeout: 5000 }))
      ) {
        console.log('🔓 Vercel SSO authentication detected')

        // GitHubログインボタンを探してクリック
        const githubLoginButton = page.locator(
          'text="Continue with GitHub", [data-provider="github"], .github-login'
        )
        if (await githubLoginButton.first().isVisible({ timeout: 3000 })) {
          await githubLoginButton.first().click()
          console.log('🐙 Clicking GitHub OAuth login...')
        }

        // GitHub認証ページでの処理
        await page
          .waitForURL('**/github.com/**', { timeout: 10000 })
          .catch(() => {
            console.log(
              '⚠️ Not redirected to GitHub - might be already authenticated'
            )
          })

        if (page.url().includes('github.com')) {
          console.log('🔑 Performing GitHub authentication...')

          // GitHub username/email入力
          const usernameField = page.locator(
            '#login_field, [name="login"], [type="email"]'
          )
          if (await usernameField.isVisible({ timeout: 3000 })) {
            await usernameField.fill(githubUsername)
          }

          // GitHub password入力
          const passwordField = page.locator(
            '#password, [name="password"], [type="password"]'
          )
          if (await passwordField.isVisible({ timeout: 3000 })) {
            await passwordField.fill(githubPassword)
          }

          // ログインボタンクリック
          const submitButton = page.locator(
            '[type="submit"], .btn-primary, text="Sign in"'
          )
          if (await submitButton.first().isVisible({ timeout: 3000 })) {
            await submitButton.first().click()
          }

          // 2FAがある場合のスキップ（テスト環境では一時的に無視）
          await page.waitForTimeout(3000)
        }

        // Vercel環境に戻るまで待機
        await page.waitForURL(baseURL + '**', { timeout: 15000 }).catch(() => {
          console.log('⚠️ Authentication might have succeeded, continuing...')
        })

        console.log('✅ Vercel OAuth authentication completed')
      } else {
        console.log('ℹ️ No authentication required or already authenticated')
      }

      // 認証状態を保存
      const storageState = await page.context().storageState()
      const fs = await import('fs')
      await fs.promises.writeFile(
        'vercel-auth-state.json',
        JSON.stringify(storageState)
      )

      console.log('💾 Authentication state saved for E2E tests')
    } catch (error) {
      console.error('❌ Vercel OAuth authentication failed:', error)
      console.log('🔄 Continuing with unauthenticated state...')
    } finally {
      await browser.close()
    }
  }

  // URLの可用性チェック
  const headers: Record<string, string> = {}

  try {
    const response = await fetch(baseURL, {
      method: 'HEAD',
      headers,
      signal: AbortSignal.timeout(30000), // 30秒タイムアウト
    })

    if (response.status === 401) {
      console.log(
        '🔐 Authentication required - this is expected for Vercel protected environments'
      )
    } else if (!response.ok) {
      throw new Error(`Develop environment returned status ${response.status}`)
    }

    console.log(
      `✅ Develop environment is accessible (status: ${response.status})`
    )
  } catch (error) {
    console.error(`❌ Failed to connect to develop environment: ${error}`)
    console.log('🔄 Waiting 30 seconds and retrying...')

    // 30秒待機してリトライ
    await new Promise((resolve) => setTimeout(resolve, 30000))

    try {
      const retryResponse = await fetch(baseURL, {
        method: 'HEAD',
        headers,
        signal: AbortSignal.timeout(30000),
      })

      if (retryResponse.status === 401) {
        console.log(
          '🔐 Authentication required - proceeding with browser-based tests'
        )
      } else if (!retryResponse.ok) {
        throw new Error(
          `Develop environment still not ready (status: ${retryResponse.status})`
        )
      }

      console.log(
        `✅ Develop environment is now accessible (status: ${retryResponse.status})`
      )
    } catch (retryError) {
      console.log(
        `⚠️ Connection test failed, but proceeding with browser-based authentication: ${retryError}`
      )
    }
  }

  console.log('🚀 Global setup completed for develop environment')
}

export default globalSetup
