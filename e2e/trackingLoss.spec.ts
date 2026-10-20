import { test, expect, knownBug } from './fixtures'
import { carryTo, dist, grabBlock, movedBlocks } from './helpers'

const ID = '2-0'

test.describe('tracking loss while holding', () => {
  knownBug('a 3-frame dropout during a carry leaves the tower intact and the block in hand [H-5]', async ({ page, driver, startGame, pageErrors }) => {
    await startGame('SANDBOX')
    const { hand } = await grabBlock(page, driver, ID)
    const out = { ...hand, z: hand.z + 5 }
    await carryTo(page, driver, out, 600)
    const before = await driver((d) => d.blockPositions())

    await driver((d) => d.dropFrames(3))
    await expect.poll(() => page.evaluate(() => (window as unknown as { __e2eDrop: number }).__e2eDrop)).toBe(0)
    await page.waitForTimeout(2000)

    const after = await driver((d) => d.blockPositions())
    expect(movedBlocks(before, after, [ID])).toEqual([])
    // Still held where the hand is: not yanked through the table and floor.
    expect(dist(after[ID], before[ID])).toBeLessThan(1)
    expect(pageErrors).toEqual([])
  })
})
