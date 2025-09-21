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

  console.log(`🔍 Debug: GITHUB_USERNAME exists: ${!!githubUsername}`)
  console.log(`🔍 Debug: GITHUB_PASSWORD exists: ${!!githubPassword}`)

  if (githubUsername && githubPassword) {
    console.log('🔐 Vercel OAuth authentication required, setting up auth...')

    // ブラウザでVercel OAuth認証を実行
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    })
    const page = await browser.newPage()

    try {
      console.log('🌐 Accessing protected Vercel environment...')
      await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 60000 })

      // 現在のURLを確認
      console.log(`🔍 Current URL: ${page.url()}`)
      console.log(`🔍 Page title: ${await page.title()}`)

      // Vercel認証画面の検出
      if (
        page.url().includes('vercel.com') ||
        (await page.title()).includes('Login') ||
        (await page
          .locator(
            '[data-testid="login-button"], .login, #login, button:has-text("Continue with GitHub")'
          )
          .first()
          .isVisible({ timeout: 10000 }))
      ) {
        console.log('🔓 Vercel SSO authentication detected')

        // GitHubログインボタンを探してクリック
        const githubLoginSelectors = [
          'text="Continue with GitHub"',
          '[data-provider="github"]',
          '.github-login',
          'button:has-text("GitHub")',
          'a:has-text("GitHub")',
          '[href*="github"]',
        ]

        let clicked = false
        for (const selector of githubLoginSelectors) {
          try {
            const button = page.locator(selector)
            if (await button.first().isVisible({ timeout: 3000 })) {
              console.log(
                `🐙 Found GitHub login button with selector: ${selector}`
              )
              await button.first().click()
              clicked = true
              break
            }
          } catch (error) {
            console.log(`⚠️ Selector ${selector} not found, trying next...`)
          }
        }

        if (!clicked) {
          console.log('⚠️ No GitHub login button found, continuing anyway...')
        }

        // GitHub認証ページでの処理
        await page
          .waitForURL('**/github.com/**', { timeout: 15000 })
          .catch(() => {
            console.log(
              '⚠️ Not redirected to GitHub - might be already authenticated'
            )
          })

        if (page.url().includes('github.com')) {
          console.log('🔑 Performing GitHub authentication...')
          console.log(`🔍 GitHub URL: ${page.url()}`)

          // ページが完全に読み込まれるまで待機
          await page.waitForLoadState('networkidle', { timeout: 10000 })

          // GitHub username/email入力
          const usernameSelectors = [
            '#login_field',
            '[name="login"]',
            '[type="email"]',
            'input[placeholder*="email"]',
            'input[placeholder*="username"]',
          ]

          let usernameField = null
          for (const selector of usernameSelectors) {
            try {
              const field = page.locator(selector)
              if (await field.isVisible({ timeout: 2000 })) {
                usernameField = field
                console.log(
                  `📧 Found username field with selector: ${selector}`
                )
                break
              }
            } catch (error) {
              console.log(`⚠️ Username selector ${selector} not found`)
            }
          }

          if (usernameField) {
            await usernameField.fill(githubUsername)
            console.log('📧 Username filled')
          } else {
            console.log('❌ No username field found')
          }

          // GitHub password入力
          const passwordSelectors = [
            '#password',
            '[name="password"]',
            '[type="password"]',
          ]

          let passwordField = null
          for (const selector of passwordSelectors) {
            try {
              const field = page.locator(selector)
              if (await field.isVisible({ timeout: 2000 })) {
                passwordField = field
                console.log(
                  `🔑 Found password field with selector: ${selector}`
                )
                break
              }
            } catch (error) {
              console.log(`⚠️ Password selector ${selector} not found`)
            }
          }

          if (passwordField) {
            await passwordField.fill(githubPassword)
            console.log('🔑 Password filled')
          } else {
            console.log('❌ No password field found')
          }

          // ログインボタンクリック
          const submitSelectors = [
            '[type="submit"]',
            '.btn-primary',
            'text="Sign in"',
            'button:has-text("Sign in")',
            '[name="commit"]',
          ]

          let submitButton = null
          for (const selector of submitSelectors) {
            try {
              const button = page.locator(selector)
              if (await button.first().isVisible({ timeout: 2000 })) {
                submitButton = button.first()
                console.log(`🔘 Found submit button with selector: ${selector}`)
                break
              }
            } catch (error) {
              console.log(`⚠️ Submit selector ${selector} not found`)
            }
          }

          if (submitButton) {
            await submitButton.click()
            console.log('🔘 Submit button clicked')
          } else {
            console.log('❌ No submit button found')
          }

          // 認証完了の待機
          await page.waitForTimeout(5000)
        }

        // Vercel環境に戻るまで待機
        await page
          .waitForURL(baseURL + '**', { timeout: 30000 })
          .catch(async () => {
            console.log(
              '⚠️ Not redirected back to Vercel, checking current state...'
            )
            console.log(`🔍 Current URL after auth: ${page.url()}`)
            console.log(`🔍 Current title after auth: ${await page.title()}`)
          })

        console.log('✅ Vercel OAuth authentication completed')
      } else {
        console.log('ℹ️ No authentication required or already authenticated')
      }

      // 現在の状態を確認
      console.log(`🔍 Final URL: ${page.url()}`)
      console.log(`🔍 Final title: ${await page.title()}`)

      // 認証状態を保存
      const storageState = await page.context().storageState()
      const fs = await import('fs')
      await fs.promises.writeFile(
        'vercel-auth-state.json',
        JSON.stringify(storageState, null, 2)
      )

      console.log('💾 Authentication state saved for E2E tests')
      console.log(`🔍 Saved cookies: ${storageState.cookies.length}`)
      console.log(`🔍 Saved origins: ${storageState.origins.length}`)
    } catch (error) {
      console.error('❌ Vercel OAuth authentication failed:', error)
      console.log('🔄 Continuing with unauthenticated state...')

      // エラーでも空の認証状態を保存
      try {
        const fs = await import('fs')
        await fs.promises.writeFile(
          'vercel-auth-state.json',
          JSON.stringify({ cookies: [], origins: [] }, null, 2)
        )
        console.log('💾 Empty authentication state saved')
      } catch (saveError) {
        console.error('❌ Failed to save empty auth state:', saveError)
      }
    } finally {
      await browser.close()
    }
  } else {
    console.log('⚠️ No authentication credentials provided')
    console.log(`🔍 GITHUB_USERNAME: ${!!githubUsername}`)
    console.log(`🔍 GITHUB_PASSWORD: ${!!githubPassword}`)
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
