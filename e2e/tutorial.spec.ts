import { test, expect } from './fixtures'
import { carryTo, frontOf, grabBlock, release, storeState } from './helpers'

const TOP_FACE = 18 * 1.5

/*
 * O-1: a first Classic game is a guided one. Each card advances on what the
 * hand does (show it, touch the glowing block, grab and let go, pull it out,
 * put it on top) and the last one comes with the first point.
 */
test('the first Classic game walks through a move to a score of 1 [O-1]', async ({ page, driver, startGame }) => {
  test.setTimeout(300_000)
  // A first visit: the fixtures mark the tutorial done for every other test
  await page.addInitScript(() => localStorage.removeItem('ar-jenga-settings'))
  await startGame('CLASSIC')
  const card = page.getByRole('region', { name: 'Tutorial' })
  const step = () => card.getAttribute('data-step')
  // Level 4's loose block (C-6)
  const TUTORIAL_TARGET = await driver((d) => d.tutorialTarget())

  await expect(card).toContainText('SHOW YOUR HAND')
  await expect(page.getByTestId('webcam-video')).toBeVisible()

  // Showing a hand moves on to calibration, which can be skipped
  const front = await frontOf(driver, TUTORIAL_TARGET)
  await driver((d, a) => d.setHand('relaxed', a), { ...front, z: front.z + 4 })
  await expect.poll(step, { timeout: 10_000 }).toBe('calibrate')
  await page.getByRole('button', { name: 'SKIP THIS STEP' }).click()
  await expect.poll(step).toBe('touch')

  // Touch, grab, let go
  const block = (await driver((d) => d.blockPositions()))[TUTORIAL_TARGET]
  const first = await grabBlock(page, driver, TUTORIAL_TARGET)
  await expect.poll(step).toBe('grab')
  await release(page, driver, first.hand)
  await expect.poll(step).toBe('pull')

  // Pull it out: the card moves on once it is clear of the tower
  const { hand } = await grabBlock(page, driver, TUTORIAL_TARGET)
  const grabbed = (await driver((d) => d.blockPositions()))[TUTORIAL_TARGET]
  const handFor = (c: { x: number; y: number; z: number }) => ({ x: c.x + hand.x - grabbed.x, y: c.y + hand.y - grabbed.y, z: c.z + hand.z - grabbed.z })
  await carryTo(page, driver, handFor({ ...block, z: block.z + 8.5 }), 2000, 600)
  await expect.poll(step, { timeout: 10_000 }).toBe('place')

  // Put it on top (as e2e/score.spec.ts)
  await carryTo(page, driver, handFor({ x: block.x, y: TOP_FACE + 4, z: block.z + 8.5 }), 3000, 600)
  const over = handFor({ x: 0.5, y: TOP_FACE + 2, z: 0.4 })
  await carryTo(page, driver, over, 1500, 1000)
  await expect.poll(async () => (await storeState(driver)).placementTarget).not.toBeNull()
  await release(page, driver, over)
  await driver((d, a) => d.moveHand('relaxed', a, 800), { ...over, z: over.z + 8 })
  await expect.poll(async () => (await storeState(driver)).score, { timeout: 30_000 }).toBe(1)

  await expect.poll(step).toBe('done')
  await expect(card).toContainText("YOU'VE GOT IT")
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ar-jenga-settings') ?? '{}'))
  expect(saved.state.tutorialDone).toBe(true)
  // The last card closes itself
  await expect(card).toBeHidden({ timeout: 10_000 })
})

test('SKIP TUTORIAL ends it for good; SETTINGS replays it [O-1]', async ({ page, driver, startGame }) => {
  test.setTimeout(180_000)
  await page.addInitScript(() => localStorage.removeItem('ar-jenga-settings'))
  await startGame('CLASSIC', { minFps: 1 })
  const card = page.getByRole('region', { name: 'Tutorial' })
  await expect(card).toBeVisible()
  await page.getByRole('button', { name: 'SKIP TUTORIAL' }).click()
  await expect(card).toBeHidden()
  expect((await driver((d) => d.store().tutorialDone))).toBe(true)

  await page.getByRole('button', { name: 'SETTINGS' }).click()
  await page.getByRole('button', { name: 'REPLAY TUTORIAL' }).click()
  await expect(card).toContainText('SHOW YOUR HAND')
  expect((await storeState(driver)).score).toBe(0)
})
