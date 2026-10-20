import { test, expect } from './fixtures'
import type { Locator, Page } from '@playwright/test'
import { frontOf } from './helpers'

/*
 * M-5: at a desktop, a portrait phone and a landscape phone, nothing on the
 * start screen or the HUD is clipped by the viewport, no control overlaps
 * another or the camera preview, and no button's label overflows it.
 */
const VIEWPORTS = [
  { name: 'desktop 1280x720', width: 1280, height: 720 },
  { name: 'phone portrait 390x844', width: 390, height: 844 },
  { name: 'phone landscape 844x390', width: 844, height: 390 },
]

type Box = { x: number; y: number; width: number; height: number }

async function boxOf(locator: Locator, label: string): Promise<Box & { label: string }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error(`${label} is not rendered`)
  return { ...box, label }
}

function expectInside(b: Box & { label: string }, page: Page) {
  const vp = page.viewportSize()!
  expect(b.x, `${b.label} left edge`).toBeGreaterThanOrEqual(0)
  expect(b.y, `${b.label} top edge`).toBeGreaterThanOrEqual(0)
  expect(b.x + b.width, `${b.label} right edge`).toBeLessThanOrEqual(vp.width + 0.5)
  expect(b.y + b.height, `${b.label} bottom edge`).toBeLessThanOrEqual(vp.height + 0.5)
}

function expectApart(a: Box & { label: string }, b: Box & { label: string }) {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  expect(w > 1 && h > 1, `${a.label} overlaps ${b.label}`).toBe(false)
}

/** Every visible button's label fits inside it */
async function expectLabelsFit(page: Page, scope: string) {
  const overflowing = await page.locator(`${scope} button`).evaluateAll((buttons) =>
    buttons
      .filter((b) => (b as HTMLElement).offsetParent !== null)
      .filter((b) => b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1)
      .map((b) => b.textContent),
  )
  expect(overflowing, `${scope} buttons whose label overflows`).toEqual([])
}

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test('the start screen fits [M-5]', async ({ page }) => {
      await page.goto('/')
      const parts = [
        await boxOf(page.locator('.glitch-title'), 'title'),
        await boxOf(page.locator('.start-subtitle'), 'subtitle'),
        await boxOf(page.getByRole('button', { name: /classic/i }), 'classic button'),
        await boxOf(page.getByRole('button', { name: /sandbox/i }), 'sandbox button'),
        await boxOf(page.locator('.start-footer'), 'footer'),
      ]
      for (const p of parts) expectInside(p, page)
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) expectApart(parts[i], parts[j])
      await expectLabelsFit(page, '.start-screen')
    })

    test('the HUD fits, with the camera preview and the settings panel open [M-5]', async ({ page, driver, startGame }) => {
      test.setTimeout(180_000)
      // Layout only: no frame-rate floor needed
      await startGame('SANDBOX', { minFps: 1 })
      await expect.poll(async () => driver((d) => d.store().isInstructionsVisible), { timeout: 10_000 }).toBe(false)
      await page.getByRole('button', { name: /show camera/i }).click()
      // A hand, so the depth gauge shows
      await driver((d, a) => d.setHand('relaxed', a), { ...(await frontOf(driver, '6-0', 3)), x: 6 })
      await expect(page.locator('.depth-gauge')).toBeVisible()

      const buttons = await page.locator('.hud-bottom-controls button').all()
      const controls = await Promise.all(buttons.map(async (b) => boxOf(b, `button "${await b.textContent()}"`)))
      const others = [
        await boxOf(page.getByTestId('webcam-video'), 'camera preview'),
        await boxOf(page.locator('.hud-title-container'), 'title'),
        await boxOf(page.locator('.hud-score'), 'score'),
        await boxOf(page.locator('.depth-gauge'), 'depth gauge'),
      ]
      const all = [...controls, ...others]
      for (const b of all) expectInside(b, page)
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expectApart(all[i], all[j])
      await expectLabelsFit(page, '.hud-bottom-controls')

      await page.getByRole('button', { name: 'SETTINGS' }).click()
      const panel = await boxOf(page.getByRole('dialog', { name: /settings/i }), 'settings panel')
      expectInside(panel, page)
      for (const c of controls) expectApart(panel, c)
      await expectLabelsFit(page, '.hud-settings-panel')
    })

    test('the tutorial card fits, clear of the controls and the camera preview [O-1, M-5]', async ({ page, driver, startGame }) => {
      test.setTimeout(180_000)
      await startGame('SANDBOX', { minFps: 1 })
      await driver((d) => d.store().startTutorial())
      // The calibrate step has the most buttons; the place step's card moves to the bottom
      for (const step of ['calibrate', 'place'] as const) {
        await driver((d, a) => d.store().setTutorialStep(a), step)
        await expect(page.locator(`.hud-tutorial[data-step="${step}"]`)).toBeVisible()
        const card = await boxOf(page.getByRole('region', { name: 'Tutorial' }), `tutorial card (${step})`)
        expectInside(card, page)
        const others = [
          await boxOf(page.getByTestId('webcam-video'), 'camera preview'),
          await boxOf(page.locator('.hud-title-container'), 'title'),
          await boxOf(page.locator('.hud-score'), 'score'),
          ...(await Promise.all((await page.locator('.hud-bottom-controls button').all()).map(async (b) => boxOf(b, `button "${await b.textContent()}"`)))),
        ]
        for (const o of others) expectApart(card, o)
        await expectLabelsFit(page, '.hud-tutorial')
      }
    })
  })
}
