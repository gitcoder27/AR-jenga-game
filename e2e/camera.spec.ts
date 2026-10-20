import { test, expect } from './fixtures'
import { carryTo, dist, frontOf, grabBlock, looseBlock, storeState } from './helpers'
import type { PoseName } from '../src/test/handPoses'
import { CAMERA_MAX_DISTANCE, CAMERA_MIN_DISTANCE, CAMERA_TARGET } from '../src/game/config'

// H-1: a relaxed or claw hand at the depths needed to reach the tower must not
// be read as "open palm" and start orbiting the camera.
test('approaching the tower with a relaxed or claw hand never moves the camera [H-1]', async ({ page, driver, startGame }) => {
  test.setTimeout(240_000)
  await startGame('SANDBOX')
  const start = await driver((d) => d.cameraPosition())
  for (const pose of ['relaxed', 'claw'] as PoseName[]) {
    for (const id of ['2-0', '4-0', '6-0']) {
      const pinch = await frontOf(driver, id, 0.6)
      await driver((d, a) => d.setHand(a.pose, a.at), { pose, at: { ...pinch, x: pinch.x - 3, z: pinch.z + 4 } })
      await page.waitForTimeout(800)
      await driver((d, a) => d.moveHand(a.pose, a.at, 1500), { pose, at: pinch })
      await page.waitForTimeout(800)
      await driver((d, a) => d.moveHand(a.pose, a.at, 1500), { pose, at: { ...pinch, x: pinch.x + 3, z: pinch.z + 4 } })
      await page.waitForTimeout(500)
      expect(dist(await driver((d) => d.cameraPosition()), start), `${pose} approach to ${id}`).toBeLessThan(0.01)
    }
  }
})

// H-2: camera control is deliberate and clutched. An open palm held still enters
// camera mode, then the hand turns the view; a pinch ends it.
test('an open palm held still enters camera mode, the hand then turns the view, and a pinch ends it [H-2]', async ({ page, driver, startGame }) => {
  await startGame('SANDBOX')
  const start = await driver((d) => d.cameraPosition())
  const at = await frontOf(driver, '6-0', 4)
  const left = { ...at, x: at.x - 3 }, right = { ...at, x: at.x + 3 }
  await driver((d, a) => d.setHand('open', a), left)
  await expect.poll(async () => (await storeState(driver)).isCameraMode, { timeout: 5000 }).toBe(true)
  await expect(page.getByText(/turning the view/i)).toBeVisible()
  expect(dist(await driver((d) => d.cameraPosition()), start), 'holding still to enter turns nothing').toBeLessThan(0.01)

  await driver((d, a) => d.moveHand('open', a, 1500), right)
  await page.waitForTimeout(800)
  expect(dist(await driver((d) => d.cameraPosition()), start)).toBeGreaterThan(0.5)

  await driver((d, a) => d.setHand('pinch', a), right)
  await expect.poll(async () => (await storeState(driver)).isCameraMode, { timeout: 5000 }).toBe(false)
  await expect(page.getByText(/turning the view/i)).toBeHidden()
  await page.waitForTimeout(500)
  const turned = await driver((d) => d.cameraPosition())
  await driver((d, a) => d.moveHand('pinch', a, 1500), left)
  await page.waitForTimeout(800)
  expect(dist(await driver((d) => d.cameraPosition()), turned), 'after the pinch').toBeLessThan(0.01)
})

// The review's H-2 check: letting go and moving the opened hand away must not turn the view.
test('opening the hand to let go and moving it away never turns the view [H-2]', async ({ page, driver, startGame }) => {
  await startGame('SANDBOX')
  const id = await looseBlock(driver, 2)
  const { hand } = await grabBlock(page, driver, id)
  const out = { ...hand, z: hand.z + 5 }
  await carryTo(page, driver, out, 1200)
  expect((await storeState(driver)).heldBlockId).toBe(id)
  const start = await driver((d) => d.cameraPosition())

  // Wide open, then away at a moderate pace (about 0.07 frame widths/s in the image)
  await driver((d, a) => d.setHand('open', a), out)
  await page.waitForTimeout(150)
  const away = { ...out, x: out.x + 6, y: out.y + 3 }
  await driver((d, a) => d.moveHand('open', a, 1500), away)
  const s = await storeState(driver)
  expect(s.heldBlockId).toBeNull()
  expect(s.isCameraMode).toBe(false)
  // Then resting in the usual relaxed pose
  await driver((d, a) => d.setHand('relaxed', a), away)
  await page.waitForTimeout(1500)
  expect((await storeState(driver)).isCameraMode).toBe(false)
  expect(dist(await driver((d) => d.cameraPosition()), start)).toBeLessThan(0.01)
  // (An open palm resting still for CAMERA_CLUTCH_HOLD_MS does enter camera mode, by design;
  // the cursor fills up first and a banner shows it.)
})

test('the C key turns camera mode on and off without the gesture [H-2]', async ({ page, driver, startGame }) => {
  await startGame('SANDBOX')
  const start = await driver((d) => d.cameraPosition())
  const at = await frontOf(driver, '6-0', 4)
  const left = { ...at, x: at.x - 3 }, right = { ...at, x: at.x + 3 }
  await driver((d, a) => d.setHand('relaxed', a), left)
  await page.waitForTimeout(1000)
  expect((await storeState(driver)).isCameraMode).toBe(false)

  await page.keyboard.press('c')
  await expect(page.getByText(/turning the view/i)).toBeVisible()
  await driver((d, a) => d.moveHand('relaxed', a, 1500), right)
  await page.waitForTimeout(800)
  expect(dist(await driver((d) => d.cameraPosition()), start)).toBeGreaterThan(0.5)

  await page.keyboard.press('c')
  await expect(page.getByText(/turning the view/i)).toBeHidden()
  const turned = await driver((d) => d.cameraPosition())
  await driver((d, a) => d.moveHand('relaxed', a, 1500), left)
  await page.waitForTimeout(800)
  expect(dist(await driver((d) => d.cameraPosition()), turned)).toBeLessThan(0.01)
})

// V-2: the camera can't go under the table, zoom out of reach or pan away, and RESET VIEW restores it.
test('orbit and zoom are limited, panning is off, and RESET VIEW restores the default framing [V-2]', async ({ page, driver, startGame }) => {
  await startGame('SANDBOX')
  const start = await driver((d) => d.cameraPosition())
  const canvas = page.locator('canvas')
  const box = (await canvas.boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const [tx, ty, tz] = CAMERA_TARGET
  const fromTarget = (p: { x: number; y: number; z: number }) => Math.hypot(p.x - tx, p.y - ty, p.z - tz)
  const polarDeg = (p: { x: number; y: number; z: number }) => (Math.acos((p.y - ty) / fromTarget(p)) * 180) / Math.PI

  // Drag up hard: tries to orbit under the table
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx, box.y + 5, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(500)
  let cam = await driver((d) => d.cameraPosition())
  expect(polarDeg(cam)).toBeLessThanOrEqual(80.5)
  expect(cam.y).toBeGreaterThan(ty)

  // Drag down hard: tries to go over the top
  await page.mouse.move(cx, box.y + 5)
  await page.mouse.down()
  await page.mouse.move(cx, box.y + box.height - 5, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(500)
  cam = await driver((d) => d.cameraPosition())
  expect(polarDeg(cam)).toBeGreaterThanOrEqual(14.5)

  // Zoom far out and in
  await page.mouse.move(cx, cy)
  for (let i = 0; i < 15; i++) await page.mouse.wheel(0, 400)
  await page.waitForTimeout(500)
  cam = await driver((d) => d.cameraPosition())
  expect(fromTarget(cam)).toBeLessThanOrEqual(CAMERA_MAX_DISTANCE + 0.1)
  for (let i = 0; i < 15; i++) await page.mouse.wheel(0, -400)
  await page.waitForTimeout(500)
  cam = await driver((d) => d.cameraPosition())
  expect(fromTarget(cam)).toBeGreaterThanOrEqual(CAMERA_MIN_DISTANCE - 0.1)

  // Right-drag would pan: the camera keeps looking at the tower axis
  await page.mouse.move(cx, cy)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(cx + 150, cy + 80, { steps: 10 })
  await page.mouse.up({ button: 'right' })
  await page.waitForTimeout(500)
  const target = await driver((d) => d.orbitTarget())
  expect(dist(target, { x: tx, y: ty, z: tz })).toBeLessThan(0.01)

  await page.getByRole('button', { name: 'SETTINGS' }).click()
  await page.getByRole('button', { name: /reset view/i }).click()
  // The orbit controls' damping eases it home at the frame rate: 0.0102 after a fixed 500 ms in one slow run
  await expect.poll(async () => dist(await driver((d) => d.cameraPosition()), start), { timeout: 5000 }).toBeLessThan(0.01)
})
