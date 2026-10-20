import { test, expect, knownBug } from './fixtures'
import { carryTo, grabBlock, release, storeState } from './helpers'

const ID = '2-0'
const TOP_Y = 18 * 1.5

// C-1 / C-3: the core loop. Extract a block, put it on top, let the tower settle: +1.
knownBug('a full move (extract, place on top, settle) scores 1 [C-1, C-3]', async ({ page, driver, startGame }) => {
  test.setTimeout(240_000)
  await startGame('CLASSIC')
  const { hand } = await grabBlock(page, driver, ID)
  const out = { ...hand, z: hand.z + 6 }
  await carryTo(page, driver, out, 900)
  const above = { x: 0, y: TOP_Y + 3, z: out.z }
  await carryTo(page, driver, above, 2500)
  const onTop = { x: 0, y: TOP_Y + 1.2, z: 0 }
  await carryTo(page, driver, onTop, 2500, 2500)
  await release(page, driver, onTop)
  await driver((d, a) => d.moveHand('tuckedReady', a, 1000), { ...onTop, z: 8 })
  await expect.poll(async () => (await storeState(driver)).score, { timeout: 20_000 }).toBe(1)
})
