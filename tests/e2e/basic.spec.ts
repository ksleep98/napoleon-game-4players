import { expect, type Page, test } from '@playwright/test'

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

  test('should display Play vs AI button', async ({ page }) => {
    await log('=== Testing Play vs AI Button ===', 'BASIC')

    await page.goto('/')
    await log('📍 Navigated to homepage')
    await takeScreenshot(page, 'before-button-check')

    // Look for Play vs AI button
    await log('🔍 Looking for Play vs AI button...')
    const playAiButton = page
      .locator('button')
      .filter({ hasText: /play.*ai|vs.*ai/i })
      .first()

    await expect(playAiButton).toBeVisible()
    await log('✅ Play vs AI button is visible')

    await takeScreenshot(page, 'play-ai-button-found')
    await log('=== Play vs AI Button Test Completed ===', 'BASIC')
  })

  test('should be responsive', async ({ page }) => {
    await log('=== Testing Responsive Design ===', 'RESPONSIVE')

    await page.goto('/')
    await log('📍 Navigated to homepage')

    const viewports = [
      { width: 375, height: 667, name: 'mobile' }, // iPhone SE
      { width: 768, height: 1024, name: 'tablet' }, // iPad
      { width: 1920, height: 1080, name: 'desktop' }, // Full HD
    ] as const

    for (const viewport of viewports) {
      await log(
        `📱 Testing ${viewport.name} viewport (${viewport.width}x${viewport.height})`
      )

      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })

      await expect(page.locator('body')).toBeVisible()
      await log(`✅ Body visible at ${viewport.name} size`)

      // Verify layout doesn't break at this viewport
      const body = page.locator('body')
      const boundingBox = await body.boundingBox()
      expect(boundingBox?.width).toBeGreaterThan(0)
      expect(boundingBox?.height).toBeGreaterThan(0)
      await log(
        `📏 Layout validated: ${boundingBox?.width}x${boundingBox?.height}`
      )

      await takeScreenshot(page, `responsive-${viewport.name}`)
    }

    await log('=== Responsive Design Test Completed ===', 'RESPONSIVE')
  })
})
