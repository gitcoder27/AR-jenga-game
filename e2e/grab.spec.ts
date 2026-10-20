import { test, expect, knownBug } from './fixtures'
import { carryTo, dist, frontOf, grabBlock, movedBlocks, release, storeState } from './helpers'

const ID = '2-0'

test.describe('grab → carry → release', () => {
  test('the pinched block follows the hand and stays put after release', async ({ page, driver, startGame, pageErrors }) => {
    await startGame('SANDBOX')
    const { hand } = await grabBlock(page, driver, ID)
    const start = (await driver((d) => d.blockPositions()))[ID]

    const out = { ...hand, z: hand.z + 5 }
    await carryTo(page, driver, out, 600)
    const carried = (await driver((d) => d.blockPositions()))[ID]
    expect(carried.z - start.z).toBeGreaterThan(3.5)

    await release(page, driver, out)
    const released = (await driver((d) => d.blockPositions()))[ID]
    // Released: lifting the open hand 4 units no longer drags the block along.
    await driver((d, a) => d.moveHand('relaxed', a, 600), { ...out, y: out.y + 4 })
    await page.waitForTimeout(1500)
    const after = (await driver((d) => d.blockPositions()))[ID]
    expect(dist(after, released)).toBeLessThan(1)
    expect(pageErrors).toEqual([])
  })

  test('heldBlockId is set during a carry and cleared after release [C-2]', async ({ page, driver, startGame }) => {
    await startGame('SANDBOX')
    const { hand } = await grabBlock(page, driver, ID)
    const out = { ...hand, z: hand.z + 5 }
    await carryTo(page, driver, out, 600)
    expect((await storeState(driver)).heldBlockId).toBe(ID)
    await release(page, driver, out)
    expect((await storeState(driver)).heldBlockId).toBeNull()
  })

  test('hovering next to a block sets hoveredBlockId [F-1]', async ({ page, driver, startGame }) => {
    await startGame('SANDBOX')
    const pinch = await frontOf(driver, ID)
    await driver((d, a) => d.setHand('tuckedReady', a), { ...pinch, z: pinch.z + 3 })
    await page.waitForTimeout(1500)
    await driver((d, a) => d.moveHand('tuckedReady', a, 1200), pinch)
    await expect.poll(async () => (await storeState(driver)).hoveredBlockId, { timeout: 8000 }).toBe(ID)
  })

  knownBug('a careful pull (≈2 units/s) does not topple the tower [G-1]', async ({ page, driver, startGame }) => {
    await startGame('SANDBOX')
    const { hand } = await grabBlock(page, driver, ID)
    const before = await driver((d) => d.blockPositions())
    await carryTo(page, driver, { ...hand, z: hand.z + 6 }, 3000, 2500)
    const after = await driver((d) => d.blockPositions())
    expect(after[ID].z - before[ID].z).toBeGreaterThan(4)
    expect(movedBlocks(before, after, [ID])).toEqual([])
  })
})
