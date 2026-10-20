import { test, expect } from './fixtures'
import { frontOf, grabBlock, looseBlock, release } from './helpers'

// Level 2's loose block, set once the game (and its tower) has started (C-6)
let ID = ''

test.describe('reset while holding', () => {
  test('grab → reset → release 20 times without page errors [G-8]', async ({ page, driver, startGame, pageErrors }) => {
    test.setTimeout(300_000)
    await startGame('SANDBOX')
    ID = await looseBlock(driver, 2)
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

// Since the move rules (C-1, C-4) every reset blew the new tower apart (top block
// thrown to y ≈ 190) and fouled it at once: the rules component's remount let a
// physics step run before the new tower's bodies were in place.
test.describe('a new tower after a reset stands', () => {
  const towerTop = (driver: Parameters<Parameters<typeof test>[2]>[0]['driver']) =>
    driver((d) => Math.max(...Object.values(d.blockPositions()).map((p) => p.y)))

  test('RE-INITIALIZE after a game over [C-1, C-4]', async ({ page, driver, startGame }) => {
    test.setTimeout(180_000)
    await startGame('CLASSIC')
    await driver((d) => d.store().foul('block-fell'))
    await page.getByRole('button', { name: 'RE-INITIALIZE' }).click()
    await page.waitForTimeout(3000)
    expect(await driver((d) => d.store().gameState)).toBe('PLAYING')
    expect(await towerTop(driver)).toBeLessThan(28)
  })

  test('REPLAY TUTORIAL [O-1]', async ({ page, driver, startGame }) => {
    test.setTimeout(180_000)
    await startGame('CLASSIC')
    await page.getByRole('button', { name: 'SETTINGS' }).click()
    await page.getByRole('button', { name: 'REPLAY TUTORIAL' }).click()
    await page.waitForTimeout(3000)
    expect(await driver((d) => d.store().gameState)).toBe('PLAYING')
    expect(await towerTop(driver)).toBeLessThan(28)
  })
})
