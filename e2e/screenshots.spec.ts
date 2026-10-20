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

      // SwiftShader: 1280×720 renders at ~2 FPS, 390×844 at ~5
      await startGame('CLASSIC', { minFps: vp.width > 1000 ? 1 : 4 })
      await page.waitForTimeout(6000) // instructions overlay fades
      await shot('2-game-no-hand')

      const pinch = await frontOf(driver, '2-0', 0.4)
      await driver((d, a) => d.setHand('relaxed', a), { ...pinch, z: pinch.z + 2 })
      await page.waitForTimeout(3000)
      await shot('3-game-hand')

      // Mirror AR (feature #10): the same moment with the webcam behind the table.
      // The fake camera's picture is a mirrored clock over a green pacman.
      await page.getByRole('button', { name: 'SETTINGS' }).click()
      await page.getByRole('button', { name: 'YOUR CAMERA' }).click()
      await page.waitForTimeout(1500)
      await shot('3b-settings-background')
      await page.getByRole('button', { name: 'Close settings' }).click()
      await page.waitForTimeout(1500)
      await shot('3c-mirror-ar')
      await page.getByRole('button', { name: 'SETTINGS' }).click()
      await page.getByRole('button', { name: 'STUDIO' }).click()
      await page.getByRole('button', { name: 'Close settings' }).click()

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

      // Hover (cyan tint, F-1), then pinch (green held tint, C-2). Last before
      // game over: sweeping the hand past a partly pulled block can topple the
      // tower (hand colliders, G-3).
      const front = await frontOf(driver, '2-0')
      await driver((d, a) => d.moveHand('tuckedReady', a, 1000), front)
      await page.waitForTimeout(3000)
      await shot('5b-hover')
      await driver((d, a) => d.setHand('tuckedPinch', a), front)
      await page.waitForTimeout(2000)
      await shot('5c-held')

      // Camera mode (H-2): an open palm held still fills the cursor, then the banner shows
      await driver((d, a) => d.setHand('relaxed', a), front)
      await page.waitForTimeout(1500)
      const palm = { ...front, z: front.z + 3 }
      await driver((d, a) => d.moveHand('open', a, 800), palm)
      await page.waitForTimeout(250)
      await shot('5d-camera-hold')
      await expect(page.getByText(/turning the view/i)).toBeVisible({ timeout: 5000 })
      await page.waitForTimeout(500)
      await shot('5e-camera-mode')

      await driver((d) => d.store().setGameState('GAME_OVER'))
      await expect(page.getByText(/collapsed/i)).toBeVisible()
      await shot('6-game-over')

      // The first-run tutorial (O-1) on its touch step: the card and the glowing block.
      // The hand leaves first, or it would be inside the new tower.
      await driver((d) => d.hideHand())
      await page.waitForTimeout(1500)
      await driver((d) => {
        d.store().startTutorial()
        d.store().setTutorialStep('touch')
      })
      await expect(page.getByRole('region', { name: 'Tutorial' })).toBeVisible()
      await page.waitForTimeout(3000)
      await shot('7-tutorial')
      // Placing on top: the card moves off the top of the tower
      await driver((d) => d.store().setTutorialStep('place'))
      await page.waitForTimeout(1000)
      await shot('7b-tutorial-place')

      // Leaving a Classic game in play asks first (O-6)
      await page.getByRole('button', { name: 'SKIP TUTORIAL' }).click()
      await page.getByRole('button', { name: 'EXIT GAME' }).click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
      await shot('8-exit-confirm')
    })
  }
})
