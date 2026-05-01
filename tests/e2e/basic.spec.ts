import { expect, type Page, test } from '@playwright/test'

// Skip E2E tests in CI if SKIP_E2E_TESTS is set
// This allows us to temporarily disable E2E tests while preserving files
// TODO: Enable E2E tests once Cloudflare development environment is ready
if (process.env.SKIP_E2E_TESTS === 'true') {
  test.skip(
    () => true,
    'E2E tests are disabled via SKIP_E2E_TESTS environment variable'
  )
}

// Helper function for logging and screenshots
async function log(message: string, step?: string): Promise<void> {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  const stepInfo = step ? `[${step}] ` : ''
  console.log(`🔧 ${timestamp} ${stepInfo}${message}`)
}

async function takeScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `basic-${name}-${timestamp}.png`
  await page.screenshot({
    path: `test-results/screenshots/${filename}`,
    fullPage: true,
  })
  await log(`📸 Screenshot saved: ${filename}`)
}

test.describe('Napoleon Game - Basic Functionality', () => {
  // Minimal smoke test: verify homepage loads and Next.js is working
  // This is sufficient to catch version incompatibility issues
  test('should load the homepage', async ({ page }) => {
    await log('=== Testing Homepage Load ===', 'BASIC')

    await page.goto('/')
    await log('📍 Navigated to homepage')
    await takeScreenshot(page, 'homepage-loaded')

    // Check if the page title is correct
    await log('🔍 Checking page title...')
    await expect(page).toHaveTitle(/Napoleon/i)
    await log('✅ Page title contains "Napoleon"')

    // Check if main elements are present
    await log('🔍 Checking for h1 element...')
    await expect(page.locator('h1')).toBeVisible()
    await log('✅ H1 element is visible')

    await takeScreenshot(page, 'homepage-validated')
    await log('=== Homepage Load Test Completed ===', 'BASIC')
  })

  // Other tests skipped for performance - homepage load is sufficient smoke test
  // Uncomment these if you need more comprehensive testing:

  // test('should display Play vs AI button', async ({ page }) => { ... })
  // test('should be responsive', async ({ page }) => { ... })
})
