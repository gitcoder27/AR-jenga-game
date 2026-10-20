import { test, expect } from './fixtures'
import { dist, frontOf } from './helpers'
import type { PoseName } from '../src/test/handPoses'

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

// The counter-check: camera control still works with a deliberate open palm.
test('sweeping a deliberate open palm still orbits the camera [H-1]', async ({ page, driver, startGame }) => {
  await startGame('SANDBOX')
  const start = await driver((d) => d.cameraPosition())
  const at = await frontOf(driver, '6-0', 4)
  await driver((d, a) => d.setHand('open', a), { ...at, x: at.x - 3 })
  await page.waitForTimeout(1000)
  await driver((d, a) => d.moveHand('open', a, 1500), { ...at, x: at.x + 3 })
  await page.waitForTimeout(800)
  expect(dist(await driver((d) => d.cameraPosition()), start)).toBeGreaterThan(0.5)
})

// V-2: the camera can't go under the table, zoom out of reach or pan away, and RESET VIEW restores it.
test('orbit and zoom are limited, panning is off, and RESET VIEW restores the default framing [V-2]', async ({ page, driver, startGame }) => {
  await startGame('SANDBOX')
  const start = await driver((d) => d.cameraPosition())
  const canvas = page.locator('canvas')
  const box = (await canvas.boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const polarDeg = (p: { x: number; y: number; z: number }) => (Math.acos(p.y / Math.hypot(p.x, p.y, p.z)) * 180) / Math.PI

  // Drag up hard: tries to orbit under the table
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx, box.y + 5, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(500)
  let cam = await driver((d) => d.cameraPosition())
  expect(polarDeg(cam)).toBeLessThanOrEqual(80.5)
  expect(cam.y).toBeGreaterThan(2)

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
  expect(Math.hypot(cam.x, cam.y, cam.z)).toBeLessThanOrEqual(28.1)
  for (let i = 0; i < 15; i++) await page.mouse.wheel(0, -400)
  await page.waitForTimeout(500)
  cam = await driver((d) => d.cameraPosition())
  expect(Math.hypot(cam.x, cam.y, cam.z)).toBeGreaterThanOrEqual(17.9)

  // Right-drag would pan: the camera keeps looking at the tower axis
  await page.mouse.move(cx, cy)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(cx + 150, cy + 80, { steps: 10 })
  await page.mouse.up({ button: 'right' })
  await page.waitForTimeout(500)
  const target = await driver((d) => d.orbitTarget())
  expect(Math.hypot(target.x, target.y, target.z)).toBeLessThan(0.01)

  await page.getByRole('button', { name: /reset view/i }).click()
  await page.waitForTimeout(500)
  expect(dist(await driver((d) => d.cameraPosition()), start)).toBeLessThan(0.01)
})
