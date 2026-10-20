# Phase 1 report: quick wins

Branch `review-fixes`. Nothing pushed. Finding IDs refer to GAME_REVIEW.md, and decisions are recorded in DECISIONS.md.

## Gate

| Check | Result |
|---|---|
| `npm run lint` | Clean (was 49 errors) |
| `npm test` (unit + headless physics) | 124 passed (31 files). Unit 87, physics 37. Known-bug tests are counted as passed because they fail as expected. |
| `npm run build` | OK. One chunk-size warning (M-3, Phase 3). |
| `npm run test:e2e` | 18 passed, including 2 known-bug tests that fail as expected (G-1 careful pull, C-1 score). 3 skipped (screenshots run only on request). 6.3 min under SwiftShader. |

## Groundwork (before item 1)

| Commit | What |
|---|---|
| `00068d9` | Physics constants, tower layout, grab logic and landmark mapping moved into shared modules (`src/game`, `src/tracking`). The app and the tests use the same code. |
| `a5e19c6` | Headless Rapier suite (`tests/physics`). It uses the same Rapier build the app ships (0.19.2), the same integration parameters and the app's own grab code. |
| `3e8b2a5` | Playwright scripted-hand E2E: a MediaPipe stub driven by `window.__e2eHand`, fake media, Chromium with SwiftShader on arm64. |
| `9c54cde` | Before screenshots at 1280×720, 390×844 and 844×390 (`docs/screenshots/before`). |

## Roadmap items

| # | Commit | Findings | Acceptance check | Result |
|---|---|---|---|---|
| 1 | `d507b99`, `bc632ee` | H-5, P-5 | Sim 4: no collateral. A live 3-frame dropout leaves the tower intact. | Pass: physics `trackingLoss`, E2E `trackingLoss` ×3, `killPlane`. |
| 2 | `006719c`, `54af1bd` | G-8 | 20× grab → reset → release with 0 page errors | Pass: E2E `reset`, physics `reset` ×3 |
| 3 | `4fbf7ec` | C-2 | The store shows the held id during a carry | Pass: E2E `grab` (C-2), physics `heldState` |
| 4 | `6ec3354` | F-1, F-2, G-5 | Hover ⇔ grabbable; hover highlight visible | Pass: physics `grabQuery`, E2E hover test, screenshot `5b-hover` |
| 5 | `ab65b98` | G-4 | Sticky-pinch test | Pass: physics sticky pinch plus 3 onset tests |
| 6 | `e94b127` | O-5, O-7 | 0 live tracks after exit | Pass: E2E `webcam` ×2 (normal exit, and exit before getUserMedia resolves) |
| 7 | `74e3c1c` | O-3, H-9, O-2 (part) | Works offline; a blocked model shows an error | Pass: E2E `assets` ×4, including real MediaPipe with every third-party host blocked |
| 8 | `6883f9f` | H-1 | Classifier is invariant over palm size s ∈ [0.06, 0.40] | Pass: `gestureState` invariance suite, E2E `camera` (relaxed or claw approach never orbits) |
| 9 | `4aaacb8` | V-2, F-5, F-3 | Camera can't go below the table; shadows are visible | Pass: E2E `camera` (V-2), screenshots |
| 10 | `c7b5b0e` | G-2 | Idle stability passes; a slow centre pull shifts the blocks above by < 1 | Pass: physics `idle` ×5, `pull` (noise-free sim 6b) |
| 11 | `29366df` | Q-1, Q-3, H-3 (docs) | CI green | Pass: the gate above |

`9d7c574` adds DECISIONS.md.

## Deviations and findings beyond the review

- **The gesture aspect bug.** MediaPipe normalizes x by frame width and y by frame height. Gesture metrics are now aspect-corrected; without this, a sideways thumb opening could fail to release on 16:9 cameras. (H-1)
- **Stale Rapier handles.** In 0.19.2, `getRigidBody(handle)` ignores the generation, so a stale handle resolves to a new body that reused its slot. Validation compares object identity instead. (G-8)
- **Gesture dropouts.** `useGesture` reset to IDLE on the first missing frame. That defeated the physics-side grace freeze, so the gesture now has the same grace period. (H-5)
- **A broken test from item 10.** The G-2 friction commit left two unit tests (Block, Floor) asserting friction 1. They failed between `c7b5b0e` and `29366df`. They now read the config constants.

## Skipped or partial, and why

- **F-5 block contrast.** The grid was removed. Block colour and contrast were left for the render-architecture work (Phase 2 #7), which rewrites block materials.
- **F-3 fade option.** Shadows and the drop marker landed. The optional "fade the hand by depth" cue was not done; the depth gauge in Phase 2 #11 covers the same need.
- **Palm-scale smoothing (H-1).** Thresholds are scale-invariant per frame. Smoothing comes with the One Euro filter (Phase 2 #6).
- **Depth is not aspect-corrected or pitch-robust.** This is H-4, Phase 2 #11.
- **O-7 has no dedicated test.** It is covered indirectly: the game view is keyed by mode, and the reset/webcam E2E tests remount it.
- **C-4 latency.** The fouls tests are still known bugs. Phase 2 #3.

## Hand-tracking feel

Nothing in this phase was measured on a real webcam. All gesture and tracking results come from scripted landmarks (E2E) and synthetic poses (unit tests). Treat the H-1 and H-5 improvements as **unverified on real hands** until the manual playtest.

## Remaining risks

- **G-1 is still the rigid joint.** A jittered careful pull still collapses the tower in sim (1.1–12.4 units of shift across seeds), and the E2E careful pull still topples it. Long carries in E2E are kept short for this reason.
- **The top of the tower is still off-screen and out of reach** (C-3). Score never increments (C-1). The core loop is not completable yet: that is Phase 2 #1–#3.
- **SwiftShader runs at about 12 FPS.** E2E timings are generous, and a 3-frame dropout lasts about 0.4 s there, longer than the 0.25 s grace. The tracking-loss tests use time-based dropouts for this reason.
- **The physics suite runs fixed steps.** Frame-rate-dependent behaviour (P-4, H-6) isn't covered until Phase 2 #6 and #9.

## Screenshots

`docs/screenshots/before/` and `docs/screenshots/after-phase1/`, at 1280×720, 390×844 and 844×390. Visible changes: no grid, shadows, hover and held tints, tracking chip, RESET VIEW, and the new HUD hint. Phone layouts are still clipped (M-5, Phase 2 #12).
