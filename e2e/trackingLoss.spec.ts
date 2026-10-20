import { test, expect } from './fixtures'
import { dist, grabBlock, movedBlocks, storeState } from './helpers'

const ID = '2-0'

// The block is held just after grabBlock's small tug, still in its slot. A longer
// carry can't be used yet: while the block is under the level above, the rigid
// grab drags the tower along with no dropout at all (G-1, Phase 2 #4).
test.describe('tracking loss while holding [H-5]', () => {
  async function holdSettled(page: import('@playwright/test').Page, driver: Parameters<typeof grabBlock>[1]) {
    await grabBlock(page, driver, ID)
    await page.waitForTimeout(2000)
    return driver((d) => d.blockPositions())
  }

  async function dropout(page: import('@playwright/test').Page, driver: Parameters<typeof grabBlock>[1], frames: number, whileLost?: () => Promise<void>) {
    await driver((d, n) => d.dropFrames(n), frames)
    await whileLost?.()
    await expect.poll(() => page.evaluate(() => (window as unknown as { __e2eDrop: number }).__e2eDrop)).toBe(0)
    await page.waitForTimeout(2000)
    return driver((d) => d.blockPositions())
  }

  test('a 3-frame dropout keeps the grab and leaves the tower intact', async ({ page, driver, startGame, pageErrors }) => {
    await startGame('SANDBOX')
    const before = await holdSettled(page, driver)
    const after = await dropout(page, driver, 3)

    // First, so a failure shows whether the dropout outlasted the grace period:
    // at SwiftShader's ~12 FPS, 3 frames are ~250 ms, the same as the grace.
    expect((await storeState(driver)).heldBlockId).toBe(ID)
    expect(movedBlocks(before, after, [ID], 0.1)).toEqual([])
    expect(dist(after[ID], before[ID])).toBeLessThan(0.3)
    expect(pageErrors).toEqual([])
  })

  // Flaky until G-4 (1 of 2 runs failed): the hand comes back still pinched and grabs again.
  test.fixme('a dropout longer than the grace period releases without yanking anything [G-4]', async ({ page, driver, startGame, pageErrors }) => {
    await startGame('SANDBOX')
    const before = await holdSettled(page, driver)
    // ~1.2 s at the ~12 FPS SwiftShader detection rate: well past the 0.25 s grace.
    // The grab must end while the hand is still lost. (When the hand comes back
    // still pinched it may grab again; pinch-onset grabbing is G-4.)
    const after = await dropout(page, driver, 15, async () => {
      await expect.poll(async () => (await storeState(driver)).heldBlockId, { intervals: [50], timeout: 3000 }).toBeNull()
      expect(await page.evaluate(() => (window as unknown as { __e2eDrop: number }).__e2eDrop)).toBeGreaterThan(0)
    })

    // Releasing drops the slightly lifted block back into its slot, so the
    // tower settles by a few centimetres; "intact" uses the default 0.3 threshold.
    expect(movedBlocks(before, after, [ID])).toEqual([])
    expect(dist(after[ID], before[ID])).toBeLessThan(0.3)
    expect(pageErrors).toEqual([])
  })
})
