import { test, expect } from './fixtures'

// H-8: inference once per camera frame, from a 640×480 capture.
test('detection runs once per camera frame, never twice on the same frame [H-8]', async ({ page, startGame }) => {
  await startGame('SANDBOX')
  const size = await page.evaluate(() => {
    const v = document.querySelector('video')!
    return { width: v.videoWidth, height: v.videoHeight }
  })
  expect(size).toEqual({ width: 640, height: 480 })

  type W = { __e2eDetectCalls: number; __e2eDuplicateDetects?: number }
  const sample = () => page.evaluate(() => {
    const w = window as unknown as W
    return { calls: w.__e2eDetectCalls, duplicates: w.__e2eDuplicateDetects ?? 0 }
  })
  const before = await sample()
  await page.waitForTimeout(3000)
  const after = await sample()
  const callsPerSecond = (after.calls - before.calls) / 3
  console.log(`H-8: ${callsPerSecond.toFixed(1)} detections/s, ${after.duplicates - before.duplicates} on an already-processed frame`)
  expect(callsPerSecond).toBeGreaterThan(5)
  expect(after.duplicates - before.duplicates).toBe(0)
})
