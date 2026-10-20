import { test, expect } from './fixtures'
import { frontOf, grabBlock, release } from './helpers'

const ID = '2-0'

test.describe('reset while holding', () => {
  test('grab → reset → release 20 times without page errors [G-8]', async ({ page, driver, startGame, pageErrors }) => {
    test.setTimeout(300_000)
    await startGame('SANDBOX')
    // grabBlock confirms the block is really held before the first reset.
    await grabBlock(page, driver, ID)
    const pinch = await frontOf(driver, ID)

    for (let i = 0; i < 20; i++) {
      if (i > 0) {
        await driver((d, a) => d.setHand('tuckedPinch', a), pinch)
        await page.waitForTimeout(700)
      }
      await driver((d) => d.store().resetGame())
      await page.waitForTimeout(400)
      await release(page, driver, pinch)
      expect(pageErrors).toEqual([])
    }
    await expect(page.locator('canvas')).toBeVisible()
    await expect.poll(() => driver((d) => Object.keys(d.blockPositions()).length)).toBe(54)
  })
})
