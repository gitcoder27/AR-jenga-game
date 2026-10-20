import { test, expect } from './fixtures'

/*
 * M-1: React commits only on discrete changes, not per detection. A stub React
 * DevTools hook (GAME_REVIEW.md §4-B) counts commits across both roots (the
 * DOM and R3F's reconciler).
 */
const COMMIT_COUNTER = `
window.__commits = 0;
window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
  supportsFiber: true,
  isDisabled: false,
  renderers: new Map(),
  inject(renderer) { const id = this.renderers.size + 1; this.renderers.set(id, renderer); return id; },
  onCommitFiberRoot() { window.__commits++; },
  onCommitFiberUnmount() {},
  onPostCommitFiberRoot() {},
  onScheduleFiberRoot() {},
  checkDCE() {},
};
`

const commits = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { __commits: number }).__commits)

test.describe('render architecture [M-1]', () => {
  test('no React commits while a tracked hand rests or moves in empty space', async ({ page, driver, startGame }) => {
    await page.addInitScript(COMMIT_COUNTER)
    await startGame('SANDBOX')
    // Beside the tower, away from every block: nothing discrete changes
    await driver((d) => d.setHand('relaxed', { x: 9, y: 14, z: 6 }))
    // The start instructions hide after 5 s: a discrete change, let it pass
    await expect.poll(async () => driver((d) => d.store().isInstructionsVisible), { timeout: 10_000 }).toBe(false)
    await page.waitForTimeout(1000)

    const atRest = await commits(page)
    await page.waitForTimeout(3000)
    const afterRest = await commits(page)
    await driver((d) => d.moveHand('relaxed', { x: 9, y: 20, z: 2 }, 2000))
    await page.waitForTimeout(500)
    const afterMove = await commits(page)

    console.log(`M-1 commits: ${afterRest - atRest} in 3 s at rest, ${afterMove - afterRest} in 2.5 s moving`)
    expect(afterRest - atRest).toBe(0)
    expect(afterMove - afterRest).toBe(0)
  })
})
