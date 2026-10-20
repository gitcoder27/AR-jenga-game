import { test, expect } from './fixtures'
import { frontOf } from './helpers'

/**
 * Before/after screenshots for visual changes. Not a regression test: runs only
 * with SCREENSHOTS=<label>, e.g. `SCREENSHOTS=before npm run test:e2e -- screenshots`,
 * and writes to docs/screenshots/<label>/.
 */
const LABEL = process.env.SCREENSHOTS
const VIEWPORTS = [
  { name: 'desktop-1280x720', width: 1280, height: 720 },
  { name: 'phone-portrait-390x844', width: 390, height: 844 },
  { name: 'phone-landscape-844x390', width: 844, height: 390 },
]

test.describe('screenshots', () => {
  test.skip(!LABEL, 'set SCREENSHOTS=<label> to capture')
  test.setTimeout(300_000)

  for (const vp of VIEWPORTS) {
    test(vp.name, async ({ page, driver, startGame }) => {
      const shot = (name: string) => page.screenshot({ path: `docs/screenshots/${LABEL}/${vp.name}-${name}.png` })
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/')
      await page.waitForTimeout(500)
      await shot('1-start')

      // 1280×720 renders at ~2 FPS in SwiftShader
      await startGame('CLASSIC', { minFps: vp.width > 1000 ? 1 : 8 })
      await page.waitForTimeout(6000) // instructions overlay fades
      await shot('2-game-no-hand')

      const pinch = await frontOf(driver, '2-0', 0.4)
      await driver((d, a) => d.setHand('relaxed', a), { ...pinch, z: pinch.z + 2 })
      await page.waitForTimeout(3000)
      await shot('3-game-hand')

      // Hover (cyan tint, F-1), then pinch (green held tint, C-2), then let go
      const front = await frontOf(driver, '2-0')
      await driver((d, a) => d.moveHand('tuckedReady', a, 1000), front)
      await page.waitForTimeout(3000)
      await shot('3b-hover')
      await driver((d, a) => d.setHand('tuckedPinch', a), front)
      await page.waitForTimeout(2000)
      await shot('3c-held')
      await driver((d, a) => d.setHand('relaxed', a), { ...pinch, z: pinch.z + 2 })
      await page.waitForTimeout(3000)

      // Hand at the left and right edges of the webcam frame
      for (const [label, x] of [['left', 0.08], ['right', 0.92]] as const) {
        await page.evaluate((x) => {
          const w = window as unknown as { __e2eHand: { x: number; y: number; z: number }[] | null }
          const hand = w.__e2eHand!
          const dx = x - hand[9].x
          w.__e2eHand = hand.map((l) => ({ ...l, x: l.x + dx }))
        }, x)
        await page.waitForTimeout(3000)
        await shot(`4-hand-edge-${label}`)
      }

      await page.getByRole('button', { name: /show camera/i }).click()
      await page.waitForTimeout(1000)
      await shot('5-hud-camera-preview')

      await driver((d) => d.store().setGameState('GAME_OVER'))
      await expect(page.getByText(/collapsed/i)).toBeVisible()
      await shot('6-game-over')
    })
  }
})
