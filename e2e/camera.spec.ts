import { test, expect, knownBug } from './fixtures'
import { dist, frontOf } from './helpers'
import type { PoseName } from '../src/test/handPoses'

// H-1 / H-2: a relaxed or claw hand at the depths needed to reach the tower
// must not be read as "open palm" and start orbiting the camera.
knownBug('approaching the tower with a relaxed or claw hand never moves the camera [H-1, H-2]', async ({ page, driver, startGame }) => {
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
