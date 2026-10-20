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
  createFromOptions: async (_vision, options) => {
    if (window.__e2eModelFail) throw new Error('e2e: model blocked');
    if (window.__e2eGpuFail && options.baseOptions.delegate === 'GPU') throw new Error('e2e: GPU delegate unavailable');
    window.__e2eDelegate = options.baseOptions.delegate;
    return {
      detectForVideo: (video) => {
        window.__e2eDetectCalls = (window.__e2eDetectCalls || 0) + 1;
        // Inference on a camera frame that was already processed (H-8)
        if (video.currentTime === window.__e2eLastVideoTime) window.__e2eDuplicateDetects = (window.__e2eDuplicateDetects || 0) + 1;
        window.__e2eLastVideoTime = video.currentTime;
        const dropping = window.__e2eDrop > 0 || performance.now() < window.__e2eDropUntil;
        if (window.__e2eDrop > 0) window.__e2eDrop--;
        if (dropping) return { landmarks: [], worldLandmarks: [], handedness: [], handednesses: [] };
        // Fresh arrays every call, like the real detector: React hooks memoize on identity.
        const hand = window.__e2eHand ? window.__e2eHand.map((l) => ({ ...l })) : null;
        return { landmarks: hand ? [hand] : [], worldLandmarks: [], handedness: [], handednesses: [] };
      },
      close() {},
    };
  },
};
`

const INIT_SCRIPT = `
window.__e2eHand = null;
window.__e2eDrop = 0;
window.__e2eDropUntil = 0;
window.__e2eDetectCalls = 0;
window.__e2eStreams = [];
window.__e2eGumDelay = 0;
// A returning player: the first-run tutorial (O-1) is off unless a test clears this
if (!localStorage.getItem('ar-jenga-settings')) {
  localStorage.setItem('ar-jenga-settings', JSON.stringify({ state: { tutorialDone: true }, version: 1 }));
}
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

export interface Options {
  /** 'stub' replaces MediaPipe with the scripted hand; 'real' loads the actual WASM and model */
  mediaPipe: 'stub' | 'real'
}

export interface Fixtures {
  /** Page errors (uncaught exceptions) collected during the test */
  pageErrors: Error[]
  /** Run a function from src/test/e2eDriver.ts in the page */
  driver: <R, A = undefined>(fn: (d: DriverModule, arg: A) => R | Promise<R>, arg?: A) => Promise<R>
  /** Click a start-screen mode and wait until the hand tracker and tower are live */
  startGame: (mode: 'CLASSIC' | 'SANDBOX', options?: { minFps?: number }) => Promise<void>
}

export async function installMediaPipeStub(page: Page): Promise<void> {
  await page.route(/@mediapipe_tasks-vision\.js/, (route) =>
    route.fulfill({ contentType: 'application/javascript', body: MEDIAPIPE_STUB }),
  )
}

export const test = base.extend<Fixtures & Options>({
  mediaPipe: ['stub', { option: true }],
  pageErrors: async ({ page }, use) => {
    const errors: Error[] = []
    page.on('pageerror', (e) => errors.push(e))
    await use(errors)
  },
  page: async ({ page, mediaPipe }, use) => {
    await page.addInitScript(INIT_SCRIPT)
    if (mediaPipe === 'stub') await installMediaPipeStub(page)
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
    await use(async (mode, { minFps = MIN_STEADY_FPS } = {}) => {
      await page.goto('/')
      await page.getByRole('button', { name: mode === 'CLASSIC' ? /classic/i : /sandbox/i }).click()
      // Tower mounted and detection loop running
      await expect.poll(() => driver((d) => Object.keys(d.blockPositions()).length), { timeout: 60_000 }).toBe(54)
      await expect.poll(() => driver((d) => d.detectCalls()), { timeout: 60_000 }).toBeGreaterThan(5)
      // SwiftShader runs at ~2 FPS while shaders compile and assets load; wait for steady state.
      await expect.poll(() => measureFps(page), { timeout: 60_000, intervals: [500] }).toBeGreaterThan(minFps)
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

/**
 * A known bug that doesn't reproduce every run: skipped as test.fixme, since
 * test.fail would turn red on the runs where it happens to pass.
 * SHOW_KNOWN_BUGS=1 runs it plainly.
 */
export const flakyKnownBug = (process.env.SHOW_KNOWN_BUGS ? test : test.fixme) as typeof test
