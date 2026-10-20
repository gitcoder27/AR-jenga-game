# Phase 2 report: make the loop complete and feel right

Branch `review-fixes`; nothing pushed. Finding IDs refer to GAME_REVIEW.md, and decisions are in DECISIONS.md.

## Gate

| Check | Result |
|---|---|
| `npm run lint` | Clean |
| `npm test` (unit + headless physics) | 218 passed (43 files): unit 153, physics 65. Known-bug tests count as passed because they fail as expected (16-0, and the levels 12–15 loose pulls). |
| `npm run build` | OK. One chunk-size warning (M-3, Phase 3, not in this run's scope). |
| `npm run test:e2e` | 41 passed, 3 skipped (the screenshot spec, which runs only on request), in 11.2 min under SwiftShader. No known-bug or fixme E2E tests remain. The previous run's one failure, a RESET VIEW timing margin, was fixed in `1909415`. |
| CI | `.github/workflows/ci.yml` (#14). It passed `actionlint`, and its steps passed in a clean worktree with `CI=1`. It hasn't run on GitHub, since nothing is pushed. |

## Phase acceptance

| Check | Result |
|---|---|
| **A completable core loop in E2E: score becomes 1** | Pass. `e2e/score.spec.ts` extracts a block, puts it on top and waits for the tower to settle: score 1, game still PLAYING. `e2e/tutorial.spec.ts` does the same through the first-run tutorial. Both are plain tests, not known bugs. |
| **The top is visible and reachable** | Pass. The framing and the tower-relative reach (#1) keep the whole tower in view and in reach at every allowed orbit and zoom (`src/tracking/mapping.test.ts` sweeps this). The score, placement and tutorial E2E place on the top. |
| **Layouts at 1280×720, 390×844 and 844×390: nothing clipped** | Pass. `e2e/layout.spec.ts` checks the start screen, the HUD with the preview, the depth gauge and the settings panel open, and the tutorial card on two steps. Nothing is outside the viewport, nothing overlaps, and no label overflows. |
| **Edge-to-edge reach at the three layouts** | Pass. The mapping is camera-frustum based (#12, M-4). The screenshot spec's hand-at-the-edges shots (`4-hand-edge-left/right`) show the hand at the frame edges at each viewport. |
| **Physics suite re-run after every physics change** | Done for P-4, G-1, G-3 and P-2/C-6. The #15 results are below. |

## Roadmap items

| # | Commit | Findings | Check | Result |
|---|---|---|---|---|
| 1 | `f6c6f17` | C-3, V-1, M-4 | The whole tower is framed and reachable | Pass: the mapping sweep and the camera E2E limits. The review's suggested camera position was adjusted (see the commit). |
| 2 | `1a9a88a` | C-3, G-6 | Ghost slot, auto-yaw, snap | Pass: physics `placement`, E2E `placement` (an odd-level block lands turned in the slot). The optional placement view was skipped, since #1's framing already shows the top. |
| 3 | `02c4ee1`, `843829f` | C-1, C-4 | Scoring; a foul within 0.5 s of a block falling, with no floor dependency | Pass: physics `moves`, `fouls` (each foul within 0.5 s), and E2E `score`. **`843829f` fixes a regression from this item, found in #13:** every reset blew the new tower apart. E2E `reset` now checks the tower stands after RE-INITIALIZE and REPLAY TUTORIAL. |
| 4 | `f5e14ff` | G-1 | Sim 6b thresholds; a yank slips | Pass. Careful pull, jittered pull and yank in physics `pull`. The E2E careful pull went from 0/3 to 4/4. |
| 5 | `f6d899e` | G-3 | Fingertip-only colliders | Pass. Brushing the tower face: max block shift 26.4 → 0.01. A 60 u/s swipe: 127.9 → 0.01. |
| 6 | `2e45c96` | H-6, H-7 | Jitter and lag | Synthetic landmarks only. Jitter RMS 0.192 → 0.068 at 30 fps; lag to 90% of a step ≤ 67 ms at 30 fps. |
| 7 | `49eaa23` | M-1, F-7 | React commits at rest ≈ 0 | Pass, `e2e/renders.spec.ts`. 3 s at rest: 46 → 0 commits. 2.5 s moving: 50 → 0. |
| 8 | `2ecfde6` | H-8 | Detections ÷ camera frames = 1.0 | Pass, `e2e/inference.spec.ts`: no duplicate detections per camera frame. Capture is 640×480. The worker is Phase 3. |
| 9 | `5393542` | P-4 | Same outcome at any frame rate | Pass, physics `frameRate`. Fingertip speed sd at 30 fps 0.87 → 0.00. Poke outcome 2.84/2.89/2.89 → 2.89 at 30/60/120 fps. |
| 10 | `5b50b72` | H-2 | No accidental orbits | Pass on scripted hands. The E2E `camera` approaches never orbit, and letting go never turns the view. The clutch needs a 400 ms still open palm; there's a HUD toggle and the C key. |
| 11 | `8d1b961` | H-3, H-4 | Mirror default, reach-in toggle, gauge, 5 s calibration | Pass on synthetic poses. A 30° pitch moves depth 0.79 (was 2.71). Calibration E2E. Needs playtests (below). |
| 12 | `f6c6f17`, `85cae05` | M-4, M-5 | Responsive layouts | Pass, `e2e/layout.spec.ts`. Before: at 390 px the start screen and EXIT were clipped, and at 844×390 the preview covered the controls (`before-m5`). |
| 13 | `ca6167a` | O-1, O-4, O-6 | Tutorial, specific camera errors, exit confirmation | Pass. E2E `tutorial` walks every step to a score of 1. Unit tests cover the camera-error mapping. E2E `exit` covers the confirmation, and a drag from the top bar orbits (before: it didn't). |
| 14 | `39c2f97` | Q-2 | Both harnesses in CI | Pass locally (see the gate). Not run on GitHub. |
| 15 | `1909415` | P-2, C-6 | The idle and pull suites pass | Pass after the changes listed below. |

## #15 in numbers (`tests/physics`)

- **Gravity ×2.**
  - ×2.5 broke the idle bound (the top sank 0.11) and three other suites.
  - Falls are 0.71× as long. That's the gravity scaling; I didn't get a new topple measurement.
- **Contact stiffness 60 Hz.** The default 30 Hz let unevenly loaded levels lean the tower by 0.17–0.25.
- **Loose blocks (C-6):**

  | | Before (identical blocks) | After (one short block per level) |
  |---|---|---|
  | Load per block | 30–37% of its level, every block | 5+ levels per seed have a block carrying < 5% |
  | Fingertip probe, 90 blocks | 0 pushed out | 12 pushed out cleanly |
  | Careful 4 u/s pull, every loose block in levels 1–11 (seeds 1–3) | — | All out; the tower moves < 0.5 |

- **The variance is 0.5%, not the review's 1–2%.** At 1–2%, 1–3 of 30 careful pulls of a loose block collapsed the
  tower: a loose block pitched into the gap above it and levered the cross block out.

## Deviations and findings beyond the review

- **The reset regression** (`843829f`, above). Since #3, every RE-INITIALIZE or RESET TOWER exploded the tower, and
  the old reset test checked only page errors. It was found while capturing the tutorial screenshots, then bisected.
- **Mechanism tests on identical blocks.** With C-6, a level's two full-height blocks carry half the level each, and
  pulling one drags the tower by design. So the tests that pull a fixed block to check a mechanism (grip, friction,
  frame rate, rules, tracking loss) run on identical blocks, and the real tower has its own loose-block tests. The
  E2E specs and the tutorial use each level's loose block.
- **Yank test.** Under ×2 gravity a 30 u/s yank comes out cleanly instead of slipping. Either way the tower isn't
  dragged. The test now checks that outcome; a 60 u/s yank still slips.
- **The tutorial card moves** to the bottom left on the place step, so it doesn't cover the top of the tower.

## Skipped or partial, and why

- **O-1:**
  - No landmark overlay on the preview.
  - No "low light" chip state: nothing measures light.
  - The tutorial runs in Classic only.
- **O-4:** the pointer-mode fallback is A-1, Phase 3. Skipped in this run (see the Phase 3 scope).
- **C-6:** difficulty presets from the seed are not done.
- **#2:** the optional placement view.
- **#8:** MediaPipe in a worker (Phase 3 #5, out of scope).

## Hand-tracking feel

Nothing in Phase 2 was measured with a real webcam or real hands. The gesture, depth, camera-mode and tutorial results
come from scripted landmarks (E2E) and synthetic poses (unit tests). Treat H-2, H-3/H-4, H-6/H-7 and the tutorial's
pacing as **unverified on real hands** until the manual playtest. That includes the stillness band of the camera-mode
clutch (0.015), which is explicitly unplaytested.

## Remaining risks

- **Upper-level drag.** A careful pull at levels 12–15 drags the levels above, loose or not. Gravity ×2 made level 15
  worse: 2.1–2.9, against 1.1–1.3 before. This is a known-bug test, in the same class as the inherited 16-0 bug. It
  needs contact-solver work.
- **E2E timing on GitHub's runners** is untested. The frame-rate floors were set on this 4-core ARM machine with
  SwiftShader.
- **SwiftShader at 390×844** runs at about 5 FPS here, so the phone-sized E2E specs use low frame-rate floors.
- **A new tower takes 3–4.5 s to settle** (was 2.5 s). The visible lean at the top is under 0.3.

## Screenshots

- Phase 2 end: `docs/screenshots/after-phase2/`. Compare with `after-phase1/`.
- Per item: `before-m5/` and `after-m5/` (layout), and `after-o1/` (the tutorial, its place step, and the exit
  confirmation).
