import { test, expect, knownBug } from './fixtures'

test.describe('asset failures [O-3, H-9]', () => {
  test('a blocked environment map shows an error instead of a blank screen', async ({ page }) => {
    await page.route(/\.hdr(\?|$)/, (route) => route.abort())
    await page.goto('/')
    await page.getByRole('button', { name: /classic/i }).click()
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: /exit/i })).toBeVisible()
  })

  knownBug('a hand-tracking model that fails to load shows an error', async ({ page }) => {
    await page.addInitScript(() => { (window as unknown as { __e2eModelFail: boolean }).__e2eModelFail = true })
    await page.goto('/')
    await page.getByRole('button', { name: /classic/i }).click()
    await expect(page.getByRole('alert').filter({ hasText: /hand tracking/i })).toBeVisible({ timeout: 30_000 })
  })
})
