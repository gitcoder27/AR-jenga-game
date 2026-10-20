import { test, expect } from './fixtures'
import { carryTo, dist, grabBlock, movedBlocks } from './helpers'

const ID = '2-0'
const FLOOR_TOP = -4.5

test.describe('tracking loss while holding', () => {
  test('a 3-frame dropout during a carry leaves the tower intact and does not yank the block [H-5]', async ({ page, driver, startGame, pageErrors }) => {
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
    // Not yanked: either still in hand (dropout within the grace period) or it
    // fell under gravity onto the floor (at ~12 FPS three frames last ~250 ms).
    expect(after[ID].y).toBeGreaterThan(FLOOR_TOP)
    expect(dist(after[ID], before[ID])).toBeLessThan(10)
    expect(pageErrors).toEqual([])
  })
})
