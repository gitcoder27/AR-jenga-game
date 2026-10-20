# Phase 3 report: mirror AR only

Branch `review-fixes`; nothing pushed. Finding IDs refer to GAME_REVIEW.md, and decisions are in DECISIONS.md.

## Scope

The brief limits Phase 3 to one item: **the "mirror AR" webcam background behind a toggle** (roadmap Phase 3 #8,
feature #10). **WebXR is skipped**, as the brief directs. There's no `immersive-ar` session, no hit-test table
placement and no phone or headset AR mode. The README says so too.

The other Phase 3 items weren't in this run's scope and weren't started:

| # | Item | Findings |
|---|---|---|
| 1 | Pointer/touch play mode | A-1 |
| 2 | Gesture-operable menus; pause and auto-pause | O-8, O-9 |
| 3 | Classic turns, pass-and-play, best scores | C-5 |
| 4 | Audio and a stability meter | F-6 |
| 5 | MediaPipe in a worker, adaptive quality, code splitting, Service Worker | H-8, M-3, O-2 |
| 6 | Stylised hand, colour-blind-safe states, reduced motion | F-4, A-2, A-3 |
| 7 | Clutch/relative mode for fatigue | A-4 |
| 9 | Collapse replay and share | feature #9 |

## Gate

| Check | Result |
|---|---|
| `npm run lint` | Clean |
| `npm test` (unit + headless physics) | 224 passed (43 files), up from 218. The new tests: 2 alignment tests in `mapping.test.ts`, 1 HUD test, 1 store test, and 2 loose-block pull tests (below). Known-bug tests count as passed because they fail as expected, as before. No physics code changed. |
| `npm run build` | OK. The same chunk-size warning (M-3, not in scope). |
| `npm run test:e2e` | 44 passed, 3 skipped (the screenshot spec, which runs only on request), in 11.7 min under SwiftShader. The 3 new tests are in `e2e/mirror.spec.ts`. The careful pull logged 0.25 for the most another block moved. The first run had one failure, below; this result is from after its fix. |

## Phase acceptance

| Check | Result |
|---|---|
| **A toggle puts the webcam behind the scene** | Pass, `e2e/mirror.spec.ts`. **SETTINGS → BACKGROUND → YOUR CAMERA**: the scene background becomes the live camera image (the fake camera's running clock shows and keeps changing), and the studio backdrop and floor mesh are hidden. **STUDIO** restores the room. |
| **Play is unchanged** | Pass. With the camera background on, all 54 blocks are in place and the hand grabs a block (same spec). Only meshes are hidden: the floor's collider stays. |
| **The hand lines up with the image** | Pass, `src/tracking/mapping.test.ts`. A landmark's video pixel shows on screen exactly where the game puts the landmark, at the three layouts plus 4:3, at two orbits and three depths. |
| **The choice persists; no camera, no change** | Pass (same spec). It survives a reload. With the camera blocked, the studio stays up, whatever the setting. |
| **Layouts at 1280×720, 390×844 and 844×390: nothing clipped** | Pass. `e2e/layout.spec.ts` checks the settings panel open at all three, now with the BACKGROUND row, and passed. Screenshots `3b-settings-background` at each viewport. |
| **Before and after screenshots** | `docs/screenshots/after-phase3/`: `*-3-game-hand` (studio, before) against `*-3c-mirror-ar` (camera, after), in the same moment and pose. The whole Phase 2 set is recaptured alongside. |

## Commits

| Commit | Findings | Change |
|---|---|---|
| `0d3efd9` | feature #10 (Phase 3 #8) | The mirror-AR background, its setting, tests, screenshots and docs |
| `b448686` | G-1, C-6 | The careful-pull E2E test pulls all the way out. Slow and paused pulls are covered headless (below). |

## Found at the gate: the careful-pull test, and paused pulls

The first full E2E run had one failure, in `e2e/grab.spec.ts`: "a careful pull does not topple the tower". It runs in
studio mode, so none of the mirror code runs there.

- **The rate:** 2 of 8 runs failed, with another block moving 0.53–0.57 against the 0.5 limit. With the tower seed
  pinned, 3 of 6 failed. So the spread comes from browser timing, not from which tower it was.
- **The cause was the test.** It carried the block 6.6 units, 0.9 short of clearing the tower, then held it there for
  2.5 s. The block, still under its cross neighbours, levered them. The headless suite reproduces this: 0.50–0.57
  for the same partial pull and hold, against 0.27–0.34 for the pull carried on out.
- **The fix (`b448686`):** the test pulls 9 units at 2 u/s, like the physics test, and requires the block to be clear.
  It passed 8 of 8 on random towers. The most another block moved was 0.13–0.36, and the test now logs that figure.
- **What it says about the game:**
  - A slow pull drags the neighbours further than a fast one. Level 2's loose block: 0.05–0.34 at 2 u/s against
    0.06–0.19 at 4 u/s (seeds 1–12). Phase 2 only tested 4 u/s. A new headless test covers 2 u/s across those 12 seeds.
  - A pull paused just short of clear moves a neighbour past 0.5 (seed 3: 0.53). That's a new known-bug test, and
    it's in the playtest checklist's questions, since players do pause mid-pull. Fixing it is physics work outside
    this phase.

## Decisions and deviations

- **Lined up, so stretched.** The background uses the hand mapping's constants, so your real fingertips are where
  the virtual pinch point is. The hand mapping fits each axis of the frame to the screen on its own (M-4's
  edge-to-edge reach). So the image stretches when the screen's shape differs from the camera's:
  - 1.33× wide for a 4:3 camera on a 16:9 screen;
  - about 2.9× narrow on a portrait phone with a landscape camera (visible in
    `phone-portrait-390x844-3c-mirror-ar.png`).

  An aspect-correct crop would break the alignment. I chose alignment; the playtest checklist asks whether the
  stretch bothers players.
- **Copied through a 2D canvas, not a `VideoTexture`.** Two reasons:
  - Under SwiftShader, uploading the `<video>` to WebGL gave black, while the same frame through a canvas showed.
    SwiftShader is the E2E browser and also Chrome's fallback on a blocklisted GPU.
  - `VideoTexture.dispose()` stops its frame updates for good, which StrictMode's dev remount triggered.

  The copy runs once per camera frame, on the same `onVideoFrames` as detection (H-8).
- **The score got a text-shadow,** like the depth gauge's labels, so it stays readable over a bright camera image.
  On the studio background the change doesn't show.
- **Docs housekeeping:** DECISIONS.md's "Given up front" table still listed H-2, H-3 and G-1 as pending. It now says
  where each was done.

## Measured, and what wasn't

- **Frame rate under SwiftShader** at 640×360, three alternating 4 s samples each:
  - camera background: 12.8–15.9 FPS;
  - studio: 11.7–13.6 FPS.

  The canvas copy costs less there than the studio's geometry and shadows. **This isn't a GPU measurement**, and real
  devices are unmeasured.
- **Nothing was tried with a real webcam or real hands.** Untested:
  - the alignment as a player sees it;
  - the stretch on a phone;
  - how the HUD reads over a real room.

  All three are in the playtest checklist.

## Not done

- **WebXR** (skipped by the brief).
- **Person segmentation:** your real hand is always behind the tower, never in front.
- **Lighting from the camera image:** the scene's lighting doesn't adapt to it.

## Final deliverable: the playtest checklist

`docs/playtest-checklist.md` turns the §3 metrics table into a manual playtest. For each metric it gives:

- the target;
- how to measure it by hand (there's no metrics overlay or telemetry; the review suggested one, and no phase built
  it);
- what the automated suites already show.

It ends with the changes that only real hands can judge: depth direction, the clutch, jitter, the soft grab, loose
blocks, gravity, the tutorial and mirror AR.
