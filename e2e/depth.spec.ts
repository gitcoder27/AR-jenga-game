import { test, expect } from './fixtures'
import { frontOf } from './helpers'
import type { Vec3 } from '../src/test/e2eDriver'

const gaugeTop = (page: import('@playwright/test').Page, part: 'hand' | 'band') =>
  page.locator(`.depth-gauge-${part}`).evaluate((el) => parseFloat((el as HTMLElement).style.top))
const bandBottom = (page: import('@playwright/test').Page) =>
  page.locator('.depth-gauge-band').evaluate((el) => parseFloat((el as HTMLElement).style.top) + parseFloat((el as HTMLElement).style.height))

/** Mean distance from the camera to the hand's joints */
async function handDistance(driver: import('./fixtures').Fixtures['driver']): Promise<number> {
  return driver((d) => {
    const c = d.cameraPosition()
    const joints = d.handJointPositions()
    return joints.reduce((s: number, j: Vec3) => s + Math.hypot(j.x - c.x, j.y - c.y, j.z - c.z), 0) / joints.length
  })
}

// H-4: hold near, then far; those sizes become the ends of the depth range.
test('calibrating near then far sets the depth range [H-4]', async ({ page, driver, startGame }) => {
  await startGame('SANDBOX')
  await page.getByRole('button', { name: 'SETTINGS' }).click()
  await page.getByRole('button', { name: /calibrate/i }).click()
  await expect(page.getByText(/as near the webcam/i)).toBeVisible()
  await driver((d) => d.setHandInImage('relaxed', 0.3, 0.5, 0.5))
  await expect(page.getByText(/now as far/i)).toBeVisible({ timeout: 6000 })
  await driver((d) => d.setHandInImage('relaxed', 0.1, 0.5, 0.5))
  await expect(page.getByText(/depth calibrated/i)).toBeVisible({ timeout: 6000 })

  const calibration = await driver((d) => d.store().depthSettings.calibration)
  console.log(`H-4 calibration: ${JSON.stringify(calibration)}`)
  expect(calibration!.near).toBeCloseTo(0.3, 1)
  expect(calibration!.far).toBeCloseTo(0.1, 1)
  // The calibrated ends are the ends of the gauge
  await driver((d) => d.setHandInImage('relaxed', 0.3, 0.5, 0.5))
  await expect.poll(() => gaugeTop(page, 'hand'), { timeout: 5000 }).toBeGreaterThan(95)
  await driver((d) => d.setHandInImage('relaxed', 0.1, 0.5, 0.5))
  await expect.poll(() => gaugeTop(page, 'hand'), { timeout: 5000 }).toBeLessThan(5)
})

// H-3: mirror by default; reach-in sends a hand that nears the webcam into the scene instead.
test('reach-in flips which way the hand moves in depth [H-3]', async ({ page, driver, startGame }) => {
  await startGame('SANDBOX')
  // A big hand: near the webcam
  await driver((d) => d.setHandInImage('relaxed', 0.3, 0.5, 0.45))
  await page.waitForTimeout(1500)
  const mirror = await handDistance(driver)
  await page.getByRole('button', { name: 'SETTINGS' }).click()
  await page.getByRole('button', { name: 'INTO THE SCENE' }).click()
  await page.waitForTimeout(1500)
  const reachIn = await handDistance(driver)
  console.log(`H-3 hand near the webcam: ${mirror.toFixed(1)} from the camera (mirror), ${reachIn.toFixed(1)} (reach-in)`)
  expect(reachIn).toBeGreaterThan(mirror + 10)
  // The choice is kept for the next visit
  expect(await page.evaluate(() => localStorage.getItem('ar-jenga-settings'))).toContain('"reachIn":true')
})

// H-3: the gauge shows the hand against the tower's depth.
test('the depth gauge shows the hand in front of, then level with, the tower [H-3]', async ({ page, driver, startGame }) => {
  await startGame('SANDBOX')
  await expect(page.locator('.depth-gauge')).toBeHidden()
  // Beside the tower, so the hand touches nothing
  const front = { ...(await frontOf(driver, '6-0', 2)), x: 7 }
  await driver((d, a) => d.setHand('relaxed', a), front)
  await expect(page.locator('.depth-gauge')).toBeVisible()
  await page.waitForTimeout(1500)
  // In front: nearer than the band (lower on the gauge)
  expect(await gaugeTop(page, 'hand')).toBeGreaterThan(await bandBottom(page))
  // Level with the tower's middle: inside the band
  await driver((d, a) => d.moveHand('relaxed', a, 1000), { ...front, z: 0 })
  await page.waitForTimeout(1500)
  const hand = await gaugeTop(page, 'hand')
  expect(hand).toBeGreaterThan(await gaugeTop(page, 'band'))
  expect(hand).toBeLessThan(await bandBottom(page))
})
