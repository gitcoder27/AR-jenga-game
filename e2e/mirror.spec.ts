import { test, expect, type Fixtures } from './fixtures'
import { grabBlock, looseBlock, storeState } from './helpers'
import type { Page } from '@playwright/test'

// Feature #10, "mirror AR": the webcam image behind the table, chosen in SETTINGS.

const background = (driver: Fixtures['driver']) => driver((d) => d.sceneBackground())

async function chooseBackground(page: Page, name: 'STUDIO' | 'YOUR CAMERA'): Promise<void> {
  await page.getByRole('button', { name: 'SETTINGS' }).click()
  await page.getByRole('button', { name }).click()
  await expect(page.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Close settings' }).click()
}

/** The top-left corner of the view: only background shows there */
const corner = (page: Page) => page.screenshot({ clip: { x: 0, y: 80, width: 160, height: 120 } })

test('YOUR CAMERA puts the live webcam behind the table; STUDIO brings the room back [feature #10]', async ({ page, driver, startGame, pageErrors }) => {
  await startGame('SANDBOX')
  expect(await background(driver)).toEqual({ kind: 'color', videoPlaying: false, studio: true, floorVisible: true })
  const studioCorner = await corner(page)

  await chooseBackground(page, 'YOUR CAMERA')
  await expect.poll(() => background(driver)).toEqual({ kind: 'video', videoPlaying: true, studio: false, floorVisible: false })
  // The pixels changed, and keep changing: the fake camera shows a running clock
  expect((await corner(page)).equals(studioCorner)).toBe(false)
  const first = await page.screenshot()
  await expect.poll(async () => (await page.screenshot()).equals(first), { timeout: 10_000 }).toBe(false)

  // The tower and the table are unchanged, and the hand still grabs
  expect(Object.keys(await driver((d) => d.blockPositions()))).toHaveLength(54)
  await grabBlock(page, driver, await looseBlock(driver, 2))
  await expect.poll(async () => (await storeState(driver)).movePhase).toBe('HOLDING')

  await chooseBackground(page, 'STUDIO')
  await expect.poll(() => background(driver)).toEqual({ kind: 'color', videoPlaying: false, studio: true, floorVisible: true })
  expect(pageErrors).toEqual([])
})

test('the choice is kept for the next visit [feature #10]', async ({ page, driver, startGame }) => {
  await startGame('SANDBOX')
  await chooseBackground(page, 'YOUR CAMERA')
  // A new page load, the same browser
  await startGame('CLASSIC')
  await expect.poll(() => background(driver)).toMatchObject({ kind: 'video', studio: false })
})

test('with no camera the studio stays, whatever the setting [feature #10]', async ({ page, driver }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ar-jenga-settings', JSON.stringify({ state: { tutorialDone: true, sceneBackground: 'camera' }, version: 1 }))
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))
  })
  await page.goto('/')
  await page.getByRole('button', { name: /sandbox/i }).click()
  await expect(page.getByRole('alert').filter({ hasText: /blocked/i })).toBeVisible()
  await expect.poll(() => driver((d) => Object.keys(d.blockPositions()).length), { timeout: 60_000 }).toBe(54)
  expect(await background(driver)).toEqual({ kind: 'color', videoPlaying: false, studio: true, floorVisible: true })
})
