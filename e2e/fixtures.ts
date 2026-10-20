/**
 * Shared Playwright fixtures for the scripted-hand E2E tests.
 *
 * - Replaces the MediaPipe module served by Vite with a stand-in whose
 *   detectForVideo() returns the landmarks in window.__e2eHand.
 * - Wraps getUserMedia to count streams (and optionally delay them).
 * - Collects page errors so every test can assert there were none.
 * - `driver` runs functions from src/test/e2eDriver.ts inside the page.
 */
import { test as base, expect, type Page } from '@playwright/test'
import type * as Driver from '../src/test/e2eDriver'

export const MEDIAPIPE_STUB = `
export const FilesetResolver = { forVisionTasks: async () => ({}) };
export const HandLandmarker = {
  createFromOptions: async () => {
    if (window.__e2eModelFail) throw new Error('e2e: model blocked');
    return {
      detectForVideo: () => {
        window.__e2eDetectCalls = (window.__e2eDetectCalls || 0) + 1;
        if (window.__e2eDrop > 0) { window.__e2eDrop--; return { landmarks: [], worldLandmarks: [], handedness: [], handednesses: [] }; }
        return { landmarks: window.__e2eHand ? [window.__e2eHand] : [], worldLandmarks: [], handedness: [], handednesses: [] };
      },
      close() {},
    };
  },
};
`

const INIT_SCRIPT = `
window.__e2eHand = null;
window.__e2eDrop = 0;
window.__e2eDetectCalls = 0;
window.__e2eStreams = [];
window.__e2eGumDelay = 0;
(() => {
  const md = navigator.mediaDevices;
  if (!md) return;
  const original = md.getUserMedia.bind(md);
  md.getUserMedia = async (constraints) => {
    const stream = await original(constraints);
    window.__e2eStreams.push(stream);
    if (window.__e2eGumDelay) await new Promise((r) => setTimeout(r, window.__e2eGumDelay));
    return stream;
  };
})();
`

type DriverModule = typeof Driver

const MIN_STEADY_FPS = 8

/** Animation frames per second over `ms`. */
export function measureFps(page: Page, ms = 1000): Promise<number> {
  return page.evaluate(
    (window) =>
      new Promise<number>((resolve) => {
        let n = 0
        const start = performance.now()
        const tick = () => {
          n++
          if (performance.now() - start < window) requestAnimationFrame(tick)
          else resolve((n * 1000) / (performance.now() - start))
        }
        requestAnimationFrame(tick)
      }),
    ms,
  )
}

export interface Fixtures {
  /** Page errors (uncaught exceptions) collected during the test */
  pageErrors: Error[]
  /** Run a function from src/test/e2eDriver.ts in the page */
  driver: <R, A = undefined>(fn: (d: DriverModule, arg: A) => R | Promise<R>, arg?: A) => Promise<R>
  /** Click a start-screen mode and wait until the hand tracker and tower are live */
  startGame: (mode: 'CLASSIC' | 'SANDBOX') => Promise<void>
}

export async function installMediaPipeStub(page: Page): Promise<void> {
  await page.route(/@mediapipe_tasks-vision\.js/, (route) =>
    route.fulfill({ contentType: 'application/javascript', body: MEDIAPIPE_STUB }),
  )
}

export const test = base.extend<Fixtures>({
  pageErrors: async ({ page }, use) => {
    const errors: Error[] = []
    page.on('pageerror', (e) => errors.push(e))
    await use(errors)
  },
  page: async ({ page }, use) => {
    await page.addInitScript(INIT_SCRIPT)
    await installMediaPipeStub(page)
    await use(page)
  },
  driver: async ({ page }, use) => {
    // Built as a string so the dynamic import reaches the browser untouched.
    await use((fn, arg) =>
      page.evaluate(
        `(async () => { const d = await import('/src/test/e2eDriver.ts'); return (${fn.toString()})(d, ${JSON.stringify(arg ?? null)}); })()`,
      ),
    )
  },
  startGame: async ({ page, driver }, use) => {
    await use(async (mode) => {
      await page.goto('/')
      await page.getByRole('button', { name: mode === 'CLASSIC' ? /classic/i : /sandbox/i }).click()
      // Tower mounted and detection loop running
      await expect.poll(() => driver((d) => Object.keys(d.blockPositions()).length), { timeout: 60_000 }).toBe(54)
      await expect.poll(() => driver((d) => d.detectCalls()), { timeout: 60_000 }).toBeGreaterThan(5)
      // SwiftShader runs at ~2 FPS while shaders compile and assets load; wait for steady state.
      await expect.poll(() => measureFps(page), { timeout: 60_000, intervals: [500] }).toBeGreaterThan(MIN_STEADY_FPS)
    })
  },
})

export { expect }

/**
 * A test for an unfixed GAME_REVIEW.md bug: runs as test.fail, so the suite
 * stays green while proving the bug reproduces, and errors once the fix lands
 * (the fix commit then switches it to `test`). SHOW_KNOWN_BUGS=1 runs it plainly.
 */
export const knownBug = (process.env.SHOW_KNOWN_BUGS ? test : test.fail) as typeof test
