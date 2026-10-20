import { test, expect } from './fixtures'
import { carryTo, dist, frontOf, grabBlock, looseBlock, movedBlocks, release, storeState } from './helpers'

// Level 2's loose block, set once the game (and its tower) has started (C-6)
let ID = ''

test.describe('grab → carry → release', () => {
  test('the pinched block follows the hand and stays put after release', async ({ page, driver, startGame, pageErrors }) => {
    await startGame('SANDBOX')
    ID = await looseBlock(driver, 2)
    const { hand } = await grabBlock(page, driver, ID)
    const start = (await driver((d) => d.blockPositions()))[ID]

    const out = { ...hand, z: hand.z + 5 }
    await carryTo(page, driver, out, 1200)
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
    ID = await looseBlock(driver, 2)
    const { hand } = await grabBlock(page, driver, ID)
    const out = { ...hand, z: hand.z + 5 }
    await carryTo(page, driver, out, 1200)
    expect((await storeState(driver)).heldBlockId).toBe(ID)
    await release(page, driver, out)
    expect((await storeState(driver)).heldBlockId).toBeNull()
  })

  test('hovering next to a block sets hoveredBlockId [F-1]', async ({ page, driver, startGame }) => {
    await startGame('SANDBOX')
    ID = await looseBlock(driver, 2)
    const pinch = await frontOf(driver, ID)
    await driver((d, a) => d.setHand('tuckedReady', a), { ...pinch, z: pinch.z + 3 })
    await page.waitForTimeout(1500)
    await driver((d, a) => d.moveHand('tuckedReady', a, 1200), pinch)
    await expect.poll(async () => (await storeState(driver)).hoveredBlockId, { timeout: 8000 }).toBe(ID)
  })

  // Toppled 3 of 3 with the rigid grab. With the soft grab (G-1) the block above (3-1)
  // moves 0.18–0.38, so the threshold is the review's sim 6b one (0.5), as in tests/physics/pull.test.ts.
  // All the way out, like that test: stopping 0.9 short and holding there levered the block
  // under its cross neighbours, which moved them 0.5–0.57 (headless too).
  test('a careful pull (≈2 units/s) does not topple the tower [G-1]', async ({ page, driver, startGame }) => {
    await startGame('SANDBOX')
    ID = await looseBlock(driver, 2)
    const { hand } = await grabBlock(page, driver, ID)
    const before = await driver((d) => d.blockPositions())
    await carryTo(page, driver, { ...hand, z: hand.z + 9 }, 4500, 2500)
    const after = await driver((d) => d.blockPositions())
    const disturbed = Math.max(...Object.keys(after).filter((k) => k !== ID).map((k) => dist(after[k], before[k])))
    console.log(`G-1 careful pull of ${ID}: the most any other block moved is ${disturbed.toFixed(2)}`)
    // Clear of the tower: a block is 7.5 long
    expect(after[ID].z - before[ID].z).toBeGreaterThan(7.5)
    expect(movedBlocks(before, after, [ID], 0.5)).toEqual([])
  })
})
