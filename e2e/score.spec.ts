import { test, expect, flakyKnownBug } from './fixtures'
import { carryTo, grabBlock, release, storeState } from './helpers'

const ID = '2-0'
const TOP_FACE = 18 * 1.5

// C-1 / C-3: the core loop. Extract a block, put it on top, let the tower settle: +1.
// The rules score this (tests/physics/moves.test.ts). End to end it passes about 1 in 3
// with the soft grab (G-1): carried over the top, the hand's 21 infinite-mass joint
// colliders hit the held block or the top level, flinging the block or letting it go
// early (G-3). Plain once the finger colliders are fixed.
flakyKnownBug('a full move (extract, place on top, settle) scores 1 [C-1, C-3]', async ({ page, driver, startGame }) => {
  test.setTimeout(240_000)
  await startGame('CLASSIC')
  const block = (await driver((d) => d.blockPositions()))[ID]
  const { hand } = await grabBlock(page, driver, ID)
  await expect.poll(async () => (await storeState(driver)).movePhase).toBe('HOLDING')

  // Keep the grab offset: the hand holds the block by its front end
  const grabbed = (await driver((d) => d.blockPositions()))[ID]
  const handFor = (c: { x: number; y: number; z: number }) => ({ x: c.x + hand.x - grabbed.x, y: c.y + hand.y - grabbed.y, z: c.z + hand.z - grabbed.z })
  // Out carefully along its length (a yank slips, G-1), up beside the tower, over the top
  await carryTo(page, driver, handFor({ ...block, z: block.z + 8.5 }), 2000, 600)
  // ~9 u/s: a 28-unit lift in 1.5 s lags past the carry slip distance at SwiftShader's ~12 FPS
  await carryTo(page, driver, handFor({ x: block.x, y: TOP_FACE + 4, z: block.z + 8.5 }), 3000, 600)
  const over = handFor({ x: 0.5, y: TOP_FACE + 2, z: 0.4 })
  await carryTo(page, driver, over, 1500, 1000)
  await expect.poll(async () => (await storeState(driver)).placementTarget).not.toBeNull()

  await release(page, driver, over)
  await driver((d, a) => d.moveHand('relaxed', a, 800), { ...over, z: over.z + 8 })
  await expect.poll(async () => (await storeState(driver)).score, { timeout: 30_000 }).toBe(1)
  expect((await storeState(driver)).gameState).toBe('PLAYING')
})
