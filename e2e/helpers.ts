import type { Page } from '@playwright/test'
import type { Vec3 } from '../src/test/e2eDriver'
import type { Fixtures } from './fixtures'

type Driver = Fixtures['driver']
type Positions = Record<string, Vec3>

/** Distance between the pinch point and a block's front end face when grabbing. */
export const STANDOFF = 0.3
const HALF_LENGTH = 3.75

export function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

/** Ids of blocks (other than `exclude`) that moved more than `threshold` between two snapshots. */
export function movedBlocks(before: Positions, after: Positions, exclude: string[] = [], threshold = 0.3): string[] {
  return Object.keys(before).filter((id) => !exclude.includes(id) && after[id] && dist(before[id], after[id]) > threshold)
}

/** Pinch point in front of the +Z end face of an even-level block (those run along Z, towards the camera). */
export async function frontOf(driver: Driver, id: string, standoff = STANDOFF): Promise<Vec3> {
  const b = (await driver((d) => d.blockPositions()))[id]
  return { x: b.x, y: b.y, z: b.z + HALF_LENGTH + standoff }
}

/**
 * Bring an open "tucked" hand in from 3 units in front of `pinch`, let the
 * smoothing settle, then pinch.
 */
export async function approachAndPinch(page: Page, driver: Driver, pinch: Vec3): Promise<void> {
  await driver((d, a) => d.setHand('tuckedReady', a), { ...pinch, z: pinch.z + 3 })
  await page.waitForTimeout(1500)
  await driver((d, a) => d.moveHand('tuckedReady', a, 1200), pinch)
  await page.waitForTimeout(2500)
  await driver((d, a) => d.setHand('tuckedPinch', a), pinch)
  await page.waitForTimeout(1200)
}

const TUG = 0.6

/**
 * Grab block `id` by its front face and confirm it with a small tug towards
 * the player. Returns the hand position after the tug, or throws if the block
 * never came along.
 *
 * Retries with a slightly shifted pinch point because, before the G-5 fix, the
 * grab query can deterministically return the hand's own fingertip instead of
 * the block (see tests/physics/grabQuery.test.ts).
 */
export async function grabBlock(page: Page, driver: Driver, id: string, attempts = 4): Promise<{ hand: Vec3; attempts: number }> {
  const base = await frontOf(driver, id)
  for (let i = 0; i < attempts; i++) {
    const pinch = { ...base, y: base.y + [0, 0.15, -0.15, 0.3][i % 4] }
    const before = (await driver((d) => d.blockPositions()))[id]
    if (i === 0) await approachAndPinch(page, driver, pinch)
    else {
      await driver((d, a) => d.moveHand('tuckedReady', a, 300), pinch)
      await page.waitForTimeout(1200)
      await driver((d, a) => d.setHand('tuckedPinch', a), pinch)
      await page.waitForTimeout(1000)
    }
    const hand = { ...pinch, z: pinch.z + TUG }
    await carryTo(page, driver, hand, 300, 800)
    const after = (await driver((d) => d.blockPositions()))[id]
    if (after.z - before.z > TUG / 2) return { hand, attempts: i + 1 }
    await driver((d, a) => d.setHand('tuckedReady', a), pinch)
    await page.waitForTimeout(600)
  }
  throw new Error(`could not grab block ${id} in ${attempts} attempts`)
}

/** Move the pinching hand to `to` over `ms`, then wait `settle` ms. */
export async function carryTo(page: Page, driver: Driver, to: Vec3, ms: number, settle = 1500): Promise<void> {
  await driver((d, a) => d.moveHand('tuckedPinch', a.to, a.ms), { to, ms })
  await page.waitForTimeout(settle)
}

/**
 * Open the hand where it is, the way people do: a relaxed open hand. (A
 * sideways thumb opening reads as a smaller gap on 16:9 webcams because
 * MediaPipe normalizes x by width; see DECISIONS.md.)
 */
export async function release(page: Page, driver: Driver, at: Vec3): Promise<void> {
  await driver((d, a) => d.setHand('relaxed', a), at)
  await page.waitForTimeout(1000)
}

/**
 * Wait until no block moves more than `threshold` over `windowMs`, then return
 * the positions. Throws if the tower is still moving after `timeoutMs`.
 */
export async function waitForRest(page: Page, driver: Driver, { threshold = 0.05, windowMs = 500, timeoutMs = 15_000 } = {}): Promise<Positions> {
  const deadline = Date.now() + timeoutMs
  let previous = await driver((d) => d.blockPositions())
  for (;;) {
    await page.waitForTimeout(windowMs)
    const current = await driver((d) => d.blockPositions())
    const moving = movedBlocks(previous, current, [], threshold)
    if (moving.length === 0) return current
    if (Date.now() > deadline) throw new Error(`tower still moving after ${timeoutMs} ms: ${moving.join(', ')}`)
    previous = current
  }
}

export async function storeState(driver: Driver) {
  return driver((d) => {
    const s = d.store()
    return {
      heldBlockId: s.heldBlockId, hoveredBlockId: s.hoveredBlockId, score: s.score, gameState: s.gameState, gameMode: s.gameMode,
      movePhase: s.movePhase, placementTarget: s.placementTarget, foulReason: s.foulReason, isCameraMode: s.isCameraMode,
    }
  })
}

/**
 * Id of `level`'s loose block in the current tower (C-6). The tests grab these:
 * a tight block can hold fast against grabBlock's tug.
 */
export function looseBlock(driver: Driver, level: number): Promise<string> {
  return driver((d, l) => d.looseBlock(l), level)
}
