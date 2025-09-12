import { expect, type Locator, type Page, test } from '@playwright/test'

// Skip E2E tests in CI if SKIP_E2E_TESTS is set
// This allows us to temporarily disable E2E tests while preserving files
// TODO: Enable E2E tests once Cloudflare development environment is ready
if (process.env.SKIP_E2E_TESTS === 'true') {
  test.skip(
    () => true,
    'E2E tests are disabled via SKIP_E2E_TESTS environment variable'
  )
}

// Helper types for performance testing
interface MemoryMetrics {
  usedJSHeapSize: number
  totalJSHeapSize: number
}

interface ViewportConfig {
  width: number
  height: number
  name?: string
}

// Standard viewport configurations
const VIEWPORT_CONFIGS: ViewportConfig[] = [
  { width: 320, height: 568, name: 'iPhone SE' },
  { width: 768, height: 1024, name: 'iPad' },
  { width: 1366, height: 768, name: 'Common laptop' },
  { width: 1920, height: 1080, name: 'Full HD' },
]

const CLICKABLE_SELECTORS = [
  'button',
  '[data-testid="card"]',
  '.card',
  'div[role="button"]',
] as const

class PerformanceTestHelper {
  constructor(private page: Page) {}

  async measureLoadTime(): Promise<number> {
    const startTime = Date.now()
    await this.page.waitForLoadState('networkidle')
    return Date.now() - startTime
  }

  async getMemoryMetrics(): Promise<MemoryMetrics | null> {
    return await this.page.evaluate(() => {
      const memory = (performance as unknown as { memory?: MemoryMetrics })
        .memory
      return memory
        ? {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
          }
        : null
    })
  }

  async startQuickGame(): Promise<void> {
    const quickStartButton = this.page
      .locator('button')
      .filter({ hasText: /quick.*start/i })
      .first()
    if (await quickStartButton.isVisible().catch(() => false)) {
      await quickStartButton.click()
      await this.page.waitForLoadState('networkidle')
    }
  }

  async performRapidClicks(maxClicks = 5): Promise<void> {
    for (const selector of CLICKABLE_SELECTORS) {
      const element = this.page.locator(selector).first()
      if (await element.isVisible().catch(() => false)) {
        for (let i = 0; i < maxClicks; i++) {
          await element.click({ timeout: 1000 }).catch(() => {
            // Ignore click failures - just testing stability
          })
          await this.page.waitForTimeout(100)
        }
        break
      }
    }
  }

  async checkElementAccessibility(
    element: Locator
  ): Promise<{ width: number; height: number } | null> {
    const boundingBox = await element.boundingBox()
    if (boundingBox) {
      return {
        width: boundingBox.width,
        height: boundingBox.height,
      }
    }
    return null
  }
}

test.describe('Napoleon Game - Performance & Accessibility', () => {
  test('should load within acceptable time', async ({ page }) => {
    const helper = new PerformanceTestHelper(page)

    const _startTime = Date.now()
    await page.goto('/')

    const loadTime = await helper.measureLoadTime()

    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000)

    // Check if main content is visible
    await expect(page.locator('body')).toBeVisible()
  })

  test('should handle rapid interactions without crashes', async ({ page }) => {
    const helper = new PerformanceTestHelper(page)

    await page.goto('/')
    await helper.startQuickGame()
    await page.waitForTimeout(3000)

    // Try rapid clicks on various elements
    await helper.performRapidClicks(5)

    // Page should still be responsive
    await expect(page.locator('body')).toBeVisible()
  })

  test('should not have memory leaks during gameplay', async ({ page }) => {
    const helper = new PerformanceTestHelper(page)

    await page.goto('/')

    // Monitor JavaScript heap size
    const initialMetrics = await helper.getMemoryMetrics()

    if (!initialMetrics) {
      // Skip test if memory API is not available
      test.skip(true, 'Memory API not available in this browser')
      return
    }

    // Play multiple game sessions
    for (let i = 0; i < 3; i++) {
      await helper.startQuickGame()
      await page.waitForTimeout(3000)

      // Go back to start
      await page.goto('/')
      await page.waitForTimeout(1000)
    }

    // Check memory usage after games
    const finalMetrics = await helper.getMemoryMetrics()

    if (finalMetrics) {
      // Memory shouldn't grow excessively (less than 50MB increase)
      const memoryIncrease =
        finalMetrics.usedJSHeapSize - initialMetrics.usedJSHeapSize
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // 50MB
    }
  })

  test('should be accessible', async ({ page }) => {
    const _helper = new PerformanceTestHelper(page)

    await page.goto('/')

    // Check for basic accessibility
    const body = page.locator('body')
    await expect(body).toBeVisible()

    // Check if interactive elements are keyboard accessible
    const quickStartButton = page
      .locator('button')
      .filter({ hasText: /quick.*start/i })
      .first()
    if (await quickStartButton.isVisible().catch(() => false)) {
      // Should be focusable
      await quickStartButton.focus()

      // Should respond to Enter key
      await page.keyboard.press('Enter')
      await page.waitForTimeout(1000)
    }

    // Check for proper heading structure
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').count()
    expect(headings).toBeGreaterThan(0)

    // Check that images have alt text (if any)
    const images = page.locator('img')
    const imageCount = await images.count()

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i)
      const altText = await img.getAttribute('alt')
      expect(altText).not.toBeNull()
    }
  })

  test('should handle network interruptions gracefully', async ({ page }) => {
    const helper = new PerformanceTestHelper(page)

    await page.goto('/')
    await helper.startQuickGame()

    // Simulate network interruption
    await page.route('**/*', (route) => {
      // Block some requests to simulate network issues
      if (Math.random() < 0.1) {
        // Block 10% of requests
        route.abort()
      } else {
        route.continue()
      }
    })

    // Continue using the app
    await page.waitForTimeout(5000)

    // App should still be functional
    await expect(page.locator('body')).toBeVisible()

    // Clear route interception
    await page.unroute('**/*')
  })

  test('should work with different screen sizes', async ({ page }) => {
    const helper = new PerformanceTestHelper(page)

    for (const viewport of VIEWPORT_CONFIGS) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      await page.goto('/')

      // Check that content is visible and accessible
      await expect(page.locator('body')).toBeVisible()

      // Look for start button
      const startButton = page
        .locator('button')
        .filter({ hasText: /start|quick|game/i })
        .first()
      if (await startButton.isVisible().catch(() => false)) {
        // Should be clickable at this viewport
        const accessibility =
          await helper.checkElementAccessibility(startButton)
        if (accessibility) {
          expect(accessibility.width).toBeGreaterThan(0)
          expect(accessibility.height).toBeGreaterThan(0)
        }
      }
    }
  })
})
