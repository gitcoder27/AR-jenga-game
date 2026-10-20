import { test, expect, knownBug } from './fixtures'
import type { Page } from '@playwright/test'

function liveTracks(page: Page): Promise<number> {
  return page.evaluate(() =>
    (window as unknown as { __e2eStreams: MediaStream[] }).__e2eStreams
      .flatMap((s) => s.getTracks())
      .filter((t) => t.readyState === 'live').length,
  )
}

test.describe('webcam lifecycle [O-5]', () => {
  knownBug('exiting a game stops every camera track', async ({ page, startGame }) => {
    await startGame('CLASSIC')
    expect(await liveTracks(page)).toBeGreaterThan(0)
    await page.getByRole('button', { name: /exit/i }).click()
    await page.waitForTimeout(1000)
    expect(await liveTracks(page)).toBe(0)
  })

  knownBug('exiting before getUserMedia resolves stops the late stream', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => { (window as unknown as { __e2eGumDelay: number }).__e2eGumDelay = 1500 })
    await page.getByRole('button', { name: /classic/i }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /exit/i }).click()
    await page.waitForTimeout(3000)
    expect(await page.evaluate(() => (window as unknown as { __e2eStreams: MediaStream[] }).__e2eStreams.length)).toBeGreaterThan(0)
    expect(await liveTracks(page)).toBe(0)
  })
})
