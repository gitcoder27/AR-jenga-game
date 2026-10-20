import { test, expect } from './fixtures'
import { carryTo, looseBlock, release, STANDOFF } from './helpers'

const HALF_LENGTH = 3.75
const TOP_FACE = 18 * 1.5
const NEW_LEVEL_Y = TOP_FACE + 0.75

// C-3 / G-6: a block from an odd level runs along X, the new top level must run
// along Z. Let go roughly over the top, it lands in the slot, turned.
test('a block from an odd level, let go over the top, snaps into the next slot turned to fit [C-3, G-6]', async ({ page, driver, startGame }) => {
  test.setTimeout(240_000)
  await startGame('SANDBOX')
  // Level 7's loose block (C-6): a tight one can hold fast against the pull
  const id = await looseBlock(driver, 7)
  const b = (await driver((d) => d.blockPositions()))[id]
  // Level 7 runs along X: look at it from +X and grab its end face head-on, like the even-level tests do from +Z
  await driver((d) => d.setOrbitAzimuth(Math.PI / 2))
  // OrbitControls damping eases the camera there; the hand mapping is camera-relative, so wait for it
  await expect.poll(async () => (await driver((d) => d.cameraPosition())).z, { timeout: 15_000 }).toBeLessThan(0.05)
  const pinch = { x: b.x + HALF_LENGTH + STANDOFF, y: b.y, z: b.z }
  await driver((d, a) => d.setHand('tuckedReady', a), { ...pinch, x: pinch.x + 3 })
  await page.waitForTimeout(1500)
  await driver((d, a) => d.moveHand('tuckedReady', a, 1200), pinch)
  await page.waitForTimeout(2500)
  await driver((d, a) => d.setHand('tuckedPinch', a), pinch)
  await page.waitForTimeout(1200)
  await expect.poll(async () => driver((d) => d.store().heldBlockId)).toBe(id)

  // Out carefully along its length (a yank slips, G-1), up, over the top, then down a little off-centre.
  // Out 10, so the lift clears the tower face by ~2 units: at 8, the 0.5 left (less the grab's lag) let the
  // block rub up the face and knock the top off in slower runs.
  const out = { ...pinch, x: pinch.x + 10 }
  await carryTo(page, driver, out, 2000, 600)
  const offset = { x: pinch.x - b.x, y: pinch.y - b.y, z: pinch.z - b.z }
  const handFor = (c: { x: number; y: number; z: number }) => ({ x: c.x + offset.x, y: c.y + offset.y, z: c.z + offset.z })
  // ~7 u/s, as in score.spec.ts: a faster lift lags past the carry slip distance at SwiftShader's ~12 FPS
  await carryTo(page, driver, handFor({ x: b.x + 10, y: TOP_FACE + 4, z: b.z }), 3000, 600)
  await carryTo(page, driver, handFor({ x: 0.8, y: TOP_FACE + 2, z: 0.5 }), 1500, 1000)
  await expect.poll(async () => driver((d) => d.store().placementTarget)).not.toBeNull()

  await release(page, driver, handFor({ x: 0.8, y: TOP_FACE + 2, z: 0.5 }))
  await driver((d, a) => d.moveHand('relaxed', a, 800), handFor({ x: 8, y: TOP_FACE + 6, z: 0.5 }))
  await page.waitForTimeout(2000)

  const placed = (await driver((d) => d.blockPositions()))[id]
  const held = await driver((d) => d.store().heldBlockId)
  expect(Math.abs(placed.y - NEW_LEVEL_Y), `placed at ${JSON.stringify(placed)}, held ${held}`).toBeLessThan(0.15)
  expect(Math.hypot(placed.x, placed.z)).toBeLessThan(0.3)
  // Level 18 runs along Z: the block's long axis is now ±Z
  const axis = (await driver((d) => d.blockAxes()))[id]
  expect(Math.abs(axis.z)).toBeGreaterThan(0.98)
})
