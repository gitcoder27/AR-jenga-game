import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

const isLocal = (url: string) => /^(https?:\/\/localhost[:/]|data:|blob:)/.test(url)

function trackingChip(page: Page) {
  return page.locator('.hud-tracking-chip')
}

test.describe('asset failures [O-3, H-9]', () => {
  test('a blocked environment map degrades gracefully: the scene keeps running', async ({ page, driver }) => {
    await page.route(/\.hdr(\?|$)/, (route) => route.abort())
    await page.goto('/')
    await page.getByRole('button', { name: /classic/i }).click()
    await expect.poll(() => driver((d) => Object.keys(d.blockPositions()).length), { timeout: 60_000 }).toBe(54)
    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.getByRole('button', { name: /exit/i })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('a hand-tracking model that fails to load shows an error with Retry', async ({ page }) => {
    await page.addInitScript(() => { (window as unknown as { __e2eModelFail: boolean }).__e2eModelFail = true })
    await page.goto('/')
    await page.getByRole('button', { name: /classic/i }).click()
    const alert = page.getByRole('alert').filter({ hasText: /hand tracking/i })
    await expect(alert).toBeVisible({ timeout: 30_000 })
    await expect(trackingChip(page)).toHaveText(/unavailable/i)

    // Retry once the model is reachable again
    await page.evaluate(() => { (window as unknown as { __e2eModelFail: boolean }).__e2eModelFail = false })
    await alert.getByRole('button', { name: /retry/i }).click()
    await expect(alert).toHaveCount(0)
    await expect(trackingChip(page)).toHaveText(/show your hand|hand tracked/i, { timeout: 30_000 })
  })

  test('falls back to the CPU delegate when the GPU path fails, with a notice', async ({ page }) => {
    await page.addInitScript(() => { (window as unknown as { __e2eGpuFail: boolean }).__e2eGpuFail = true })
    await page.goto('/')
    await page.getByRole('button', { name: /classic/i }).click()
    await expect(trackingChip(page)).toContainText('CPU', { timeout: 30_000 })
    expect(await page.evaluate(() => (window as unknown as { __e2eDelegate: string }).__e2eDelegate)).toBe('CPU')
  })
})

test.describe('offline [O-3, H-9]', () => {
  test.use({ mediaPipe: 'real' })

  test('the real MediaPipe WASM and model load with every third-party host blocked', async ({ page }) => {
    test.setTimeout(180_000)
    const external: string[] = []
    await page.route((url) => !isLocal(url.toString()), (route) => {
      external.push(route.request().url())
      return route.abort()
    })
    await page.goto('/')
    await page.getByRole('button', { name: /classic/i }).click()
    // The fake camera shows no hand, so a working tracker settles on "no hand".
    await expect(trackingChip(page)).toHaveText(/show your hand/i, { timeout: 150_000 })
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(external).toEqual([])
  })
})
