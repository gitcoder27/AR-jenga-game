import { test, expect } from './fixtures'
import { dist } from './helpers'

// O-6: leaving a Classic game in play asks first; the top bar no longer swallows orbit drags.
test('EXIT GAME in a Classic game asks first; KEEP PLAYING stays, LEAVE goes [O-6]', async ({ page, startGame }) => {
  await startGame('CLASSIC')
  await page.getByRole('button', { name: /exit game/i }).click()
  await expect(page.getByRole('alertdialog', { name: /leave this game/i })).toBeVisible()
  await page.getByRole('button', { name: 'KEEP PLAYING' }).click()
  await expect(page.getByRole('alertdialog')).toBeHidden()
  await expect(page.getByRole('button', { name: /exit game/i })).toBeVisible()

  await page.getByText('ROBOTIC JENGA').click()
  await page.getByRole('button', { name: 'LEAVE' }).click()
  await expect(page.getByRole('button', { name: /classic/i })).toBeVisible()
})

test('a mouse drag that starts on the top bar still orbits the view [O-6]', async ({ page, driver, startGame }) => {
  await startGame('SANDBOX')
  const start = await driver((d) => d.cameraPosition())
  const vp = page.viewportSize()!
  // Between the title and the score
  const x = vp.width * 0.72, y = 20
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - 150, y + 40, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(1500)
  expect(dist(await driver((d) => d.cameraPosition()), start)).toBeGreaterThan(0.5)
})
