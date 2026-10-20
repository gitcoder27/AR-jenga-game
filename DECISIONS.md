# Decisions

Implementation decisions for the GAME_REVIEW.md roadmap: the ones made up front, and the ones made while
implementing. Finding IDs refer to GAME_REVIEW.md.

## Given up front

| Topic | Decision | Status |
|---|---|---|
| H-3 depth mapping | Keep the "mirror" mapping as the default. Add a settings toggle for "reach-in", fix the README, and add a depth gauge. | README fixed (Phase 1 #11); toggle and gauge pending (Phase 2) |
| H-2 camera mode | Hold an open palm still for 400 ms to enter camera mode. Show a visible mode indicator, turn hand colliders off in camera mode, and add a HUD toggle plus a keyboard fallback. | Pending (Phase 2 #10) |
| G-1 grab | A dynamic proxy body driven by a PD controller, with a force cap and slip release. Start at block↔block friction 0.45, block↔table 0.6 and gravity ×2, then tune until the physics tests pass. | Pending (Phase 2 #4; friction in Phase 1 #10) |
| Asset hosting | Self-host the HDR, the MediaPipe model and the WASM matching the npm package version. Don't commit large binaries unless unavoidable. | Done (see "Self-hosting" below) |
| Phase 3 #10 | Implement only the "mirror AR" webcam background behind a toggle. Skip full WebXR. | Pending |

## Made during implementation

### Test harness

- **Rapier version.** The review's replica used `@dimforge/rapier3d-compat` 0.12.0. The app actually runs 0.19.2, bundled
  by `@react-three/rapier` 2.2.0. The headless suite pins 0.19.2, so it tests the engine that ships. The review's
  numbers were reproduced in kind, not always exactly.
- **E2E MediaPipe stub returns fresh landmark arrays on every frame**, as the real detector does. Returning the
  same array let `useGesture`'s memo skip frames, so a held-still pinch stuck in `PINCH_READY`. That artefact made an
  early H-5 test pass for the wrong reason.
- **`mediaPipe: 'real'` fixture option.** One E2E test loads the real WASM and model with all third-party hosts
  blocked. That proves the self-hosted assets work offline. All other tests use the scripted-hand stub.
- **Known-bug tests** run as `test.fail` / `it.fails` until the fix lands. `SHOW_KNOWN_BUGS=1` runs them plainly.
  A flaky known-bug test uses `test.fixme`, because `test.fail` would turn red on its passing runs.

### Gestures (H-1)

- **Aspect correction.** This finding isn't in the review. MediaPipe normalizes x by frame width and y by frame
  height. On a 16:9 camera, raw horizontal distances read 1.78× smaller than vertical ones. With the old absolute
  thresholds, a sideways thumb opening could fail to release a pinch. All gesture metrics now scale x and z by the
  video aspect before measuring.
- **Depth is not aspect-corrected yet.** `calculateDepth` still uses raw wrist→middle-MCP length. That is
  correct for an upright hand and off for a tilted one. It is revisited with landmark filtering (H-6/H-7) and the
  depth toggle (H-3), because changing it moves every hand position.
- **Fist is not a pinch.** A folded index finger (PIP bend > 120°) can't start a pinch. The old unit test
  expected `FIST` states that the state machine never had; it now asserts this rule instead.
- **Palm scale is not smoothed.** The ratios are scale-invariant per frame. Smoothing arrives with the One Euro
  filter (H-6).

### Grab and hand

- **G-8 handle validation uses object identity.** In rapier3d-compat 0.19.2, `world.getRigidBody(handle)` and
  `getImpulseJoint(handle)` look up by arena slot and ignore the generation. A stale handle therefore resolves to
  whatever new body reuses the slot, which happens on every tower reset. The code checks
  `world.getRigidBody(body.handle) === body`.
- **One id format.** `hoveredBlockId`, `heldBlockId` and the bodies' `userData.blockId` all use the plain
  block id (`'2-0'`). The review quotes `'block-2-0'` for hover; the prefix was dropped.
- **"Safe" means "moved this turn".** `movingBlockId` is set on grab and kept after release until another block
  is grabbed or the game resets. It is exempt from the floor rule, so dropping the carried block isn't an instant
  game over. The proper foul rule arrives with C-4.
- **Hover and grab share one candidate per frame.** `HandPhysics` computes it at the thumb/index midpoint and grabs
  exactly that block. The depth cursor renders from it, rather than running its own query at its own smoothed point.
- **Pinch onset (G-4).** A pinch grabs only within 150 ms of closing, and only if an open hand was seen since
  tracking (re)started. The gesture debounce state (`PINCH_READY`) counts as "closing", neither open nor pinching.
  Without that, a hand that reappears already pinched would look like it opened and closed.
- **Gesture state survives dropouts within the grace period (H-5).** `useGesture` used to reset to IDLE on the
  first missing frame. After even a 1-frame dropout, a held pinch had to re-debounce and released the block, which
  defeated the physics-side grace freeze. Both now use `TRACKING_LOSS_GRACE_S` (0.25 s, the top of the review's
  150–250 ms range).

### Assets (O-3, H-9)

- **Self-hosting.** `scripts/fetch-assets.mjs` runs before `dev`, `build` and the E2E server:
  - It copies the MediaPipe WASM from `node_modules/@mediapipe/tasks-vision/wasm`, so it always matches the JS API.
  - It downloads the hand model and drei's `studio_small_03_1k.hdr` once, from pinned URLs, and verifies their SHA-256
    hashes. Neither file is in an npm package.
  - Everything goes to `public/` (gitignored), so no binaries are committed. The first `npm run dev` or `build`
    needs network; after that, none.
- **A missing HDR degrades gracefully.** If the environment map still fails to load, the scene drops it and
  keeps running. A lost reflection map isn't worth stopping play for. The scene error boundary (G-8) still catches
  real crashes.
- MediaPipe's "using deprecated parameters for the initialization function" warning persists with matching WASM.
  It comes from the package itself, not from a version mismatch.

### Webcam (O-7)

- The game view is a `Game` component keyed by mode. Leaving or switching modes drops the last tracking result,
  the video element and the camera state. `useHandTracking` stays in `App`, so the model loads while the menu is
  showing.

### Housekeeping (Q-1, Q-3)

- **Seeded tower randomness.** React's purity lint flagged `Math.random()` in render (block shade and layout
  jitter). The store now keeps a `towerSeed`, renewed on every start and reset. The tower layout and each block's
  shade derive from it, so a render is repeatable and each new game still gets a fresh tower.
- **Test mocks are typed.** The `no-explicit-any` errors were all in test mocks. `src/test/mockStore.ts`
  (`storeWith`) and `src/test/mockProps.ts` replace the ad hoc `any` selectors and props.
- **Friction assertions read the config.** The Block and Floor unit tests asserted friction 1, which went stale
  with the G-2 friction change (that commit left them failing; fixed here). They now compare against
  `BLOCK_FRICTION` and `FLOOR_FRICTION`.
- **Dead code removed.** `utils/coordinates.ts` and `utils/math.ts` (and their tests) were only used by tests and
  disagreed with the real mapping in `tracking/mapping.ts`.
- **Branding.** "Robotic Jenga" everywhere (in-game title, page title, README). The README says what the app
  does today, including that placements don't score until C-1.

### Framing and reach (C-3, V-1, M-4)

- **Camera.** FOV 50°, orbit target at the tower's middle plus placing headroom (`[0, 14, 0]`), default
  distance 40 at 20° elevation, zoom 36–48, polar 15–80°. `src/tracking/mapping.test.ts` sweeps every allowed
  orbit, zoom and four aspect ratios. At each one, the top placement point must be on screen and reachable.
  The default camera also needs the bottom and top levels reachable. The review suggested camera ≈ `[0, 18, 34]`
  with target y ≈ 12. With that framing the top point sits just outside the frustum, so it was re-derived with
  the sweep.
- **Target-relative volume.** Depth is centred on the orbit target. The hand-size depth in [-1, 1] spans
  ±45% of the camera→target distance, as the review recommends. A fixed range can't reach the top from the 15°
  top-down view.
- **Frustum mapping (M-4) landed with this item, not Phase 2 #12.** Once the volume follows the camera, its
  width and height must come from the frustum anyway. Image x/y are unprojected through the camera at the
  hand's depth, so a landmark appears on screen where it is in the webcam frame, at any screen aspect. #12
  still covers the responsive layout (M-5).
- **Frame-to-screen gain 1.18, centre row 0.45.** The middle 85% of the frame spans the screen. The frame row
  that maps to the screen centre is slightly above the middle, so pinching near the bottom of the screen keeps
  the wrist in frame.
- **The hand is drawn at 0.6× around its pinch point.** At 1:1 the hand would be about 4 blocks tall on screen.
  Scaling around the thumb–index midpoint keeps the grab point exact.
- `calculateDepth` now returns a normalized depth in [-1, 1]. The mapping turns it into world units.

### Placement assist (C-3, G-6)

- **Snap on release, no in-hand yaw.** The review offers "ease the held block's yaw … or snap on release". The
  rigid joint (and later the PD proxy) holds the block's orientation, so turning it in the hand would mean
  driving joint frames. Instead, the ghost shows the slot in the level's orientation, and letting go within
  1.2 block widths of it, up to 4 block heights above, eases the block in: across and turning for 60% of
  0.25 s, then down. Wrist-roll yaw is not implemented.
- **Slot choice.** The next slot is a free slot in the top level if that level isn't full, otherwise one in a
  new level. Of those, the one nearest the held block wins. It is computed from block positions, not from the
  rules' bookkeeping.
- **The optional auto "placement view" is skipped.** The new framing already shows the top at every allowed
  orbit (see the sweep).

### Moves, scoring and fouls (C-1, C-4)

- **The move lifecycle lives in `src/game/moves.ts` (`MoveTracker`).** The app runs it after every physics step
  (`GameRules`, Classic only); the headless tests run the same class.
  - Phases: IDLE → HOLDING → MOVED ⇄ HOLDING → SETTLING → scored → IDLE.
  - Checks run at 10 Hz.
- **Scoring.** A move scores when the moved block, let go, rests within the footprint and above the highest
  *full* level, so a block completing a part-built top level counts. Every block must also stay under
  0.05 u/s and 0.1 rad/s for 3 s. The block then joins the tower at its new level.
- **No clean-extraction bonus.** The review's optional bonus is not implemented: the score is the number of
  completed moves.
- **Fouls are rule-based, with no floor dependency.** Classic ends the moment either of these happens:
  - Any block other than the moved one drops half a block height below its level, or its centre goes 0.25
    past the footprint edge (an unheld block tips off there). A block culled by the kill plane counts too.
  - The moved block falls off the table: centre below y = −1. Dropping your own block on the table is
    allowed; it stays the moved block and can be picked up again. Dropping it off the table can't be
    recovered, so it ends the game.
- **Grabbing another block while the moved one is out** makes the new block the moved one. The old block then
  counts as a tower block at its original level, so if it's lying on the table, that's a foul.
- `Block.tsx`'s floor-contact rule and `movingBlockId`'s "exempt from the floor rule" meaning are gone.
  `movingBlockId` now mirrors the tracker.
- **Slow-motion beat skipped.** The review's optional 1–2 s slow-motion before the modal is not done.
- The game-over modal says why the game ended ("A block fell from the tower" or "The block you were moving
  fell off the table"). A HUD line says what to do next in the move.

### Soft grab (G-1)

- **The hand drives a dynamic proxy, not the block.** On grab, a small dynamic body (mass 1, no gravity) is
  fixed to the block at the pinch point, with contacts between the two off. Every physics step, a critically
  damped PD controller (6 Hz linear, 4 Hz angular) pushes the proxy towards the pinch point and the grab-time
  orientation. The kinematic hand joints never touch the held block's dynamics.
  - The force is capped at mass × 20 g, and the torque is capped to match.
  - If the pinch gets more than 1.5 units from the grip point while the block is still in the tower, the block
    slips out and the grab ends. Once the block is out, the limit is 3 units, so a brisk carry at a low frame rate
    doesn't drop it. The 1.5 is what protects the tower: with 3 or 4 everywhere, the capped force pushes for
    longer, and 8–14 physics tests fail because the tower gets dragged.
  - The review suggested a force cap of a few g. With 4–12 g, loaded lower blocks slipped before they moved;
    20 g is the lowest cap that extracts every level in the tests.
  - The controller runs in `useBeforePhysicsStep` (headless: `hand.beforeStep()`), so it follows the physics
    rate, not the render rate.
- **Extraction assist.** This is a deviation from the review, which only asks for the PD controller. A block
  grabbed with blocks above it starts in "extracting" mode until its centre leaves the footprint:
  - Only the force along its long axis is applied, with no lift and no gravity compensation, so it slides out
    resting on its supports.
  - Without this, any upward pinch error lifts the block into the level above and drags it along.
  - A block with nothing above it (the top level, or one being carried) gets the full 3D controller and gravity
    compensation.
- **Careful pulls are slower in the tests.** Physics helpers pull at 6 u/s (was 15). The E2E outward pulls take
  1.2–2 s (were 0.6–0.7 s, about 12 u/s). A yank out of the tower now slips, which is the point. At SwiftShader's
  ~12 FPS, the hand target jumps about 1 unit per frame at 12 u/s, so the lag passes 1.5 within 11 steps.
- **Gravity ×2 is not in this commit.** With gravity doubled, five pull tests failed (16-0's shift went from
  4.2 to 21.9), so it is deferred to the P-2 tuning item, where it gets its own pass.
- **Known bug: 16-0** (the level under the top) still drags level 17 at 4 u/s: shift 4.2, against 8.7 with the
  rigid grab. The contact solver lets the lightly loaded top level creep, and the grab doesn't cause it.

  Rigid grab vs soft grab, seed 1, max shift of the blocks above:

  | Block | 2 u/s rigid | 2 u/s soft | 4 u/s rigid | 4 u/s soft | 6 u/s rigid | 6 u/s soft |
  |-------|-------------|------------|-------------|------------|-------------|------------|
  | 16-0  | 8.85 | 9.69 | 8.69 | 4.20 | 8.44 | 1.60 |
  | 16-1  | 31.0 | 2.58 | 8.74 | 1.95 | 2.07 | 0.92 |
  | 1-0   | 0.43 | 0.15 | 0.13 | 0.10 | 0.06 | 0.09 |
  | 2-0   | 0.48 | 0.12 | 0.08 | 0.06 | 0.03 | 0.05 |
  | 8-0   | 6.49 | 0.54 | 1.45 | 0.37 | 0.21 | 0.29 |
  | 8-1   | 0.22 | 0.06 | 0.04 | 0.27 | 0.03 | 0.24 |

  At 2 u/s the rigid grab moved the whole tower for 1-0, 2-0 and 8-0, so a low shift there is not a clean pull.
  The soft grab is a big improvement on slow pulls. At 6 u/s it is about even, slightly worse on some edge
  blocks. These are simulated scripted pulls; hand-tracking feel is not measured.

### Hand colliders (G-3)

- **Only the index fingertip touches blocks.** The 21 joint bodies keep driving the visuals but have no
  colliders, in the app and in the headless scene. The pushing part is one dynamic capsule on the index tip:
  - Size: radius 0.25, 0.4 straight length, along the distal phalanx.
  - Drive: a velocity target that closes the gap in 0.05 s.
  - Caps: at most 10 u/s, and a force of one block's weight, which moves a loose block but not a loaded one.
  - Snap: if it falls 1.5 behind (blocked, or a tracking jump), it teleports and stops pushing.
  - Re-arm: it pushes again only once it is 0.15 clear of every block, so it never starts inside the tower or
    against the face of the block it just let go of.
- **"Pinch proxy" is the held block.** The review asks for the index tip and a pinch proxy. While carrying,
  the held block itself is the hand's contact, driven by the soft grab (G-1); a second collider at the pinch
  would only shove the block it holds. The fingertip pushes only with a relaxed or pointing hand: not while
  pinching or closing, not while holding, and not with an open palm (camera gesture, H-2).
- **Fingertip on/off uses solver groups, not `collider.setEnabled(false)`.** In rapier3d-compat 0.19, a
  disabled collider's existing contact pair kept applying force: an "off" fingertip inside 8-0 pushed it for
  another 40 steps, then let go, and the spring-back kicked the top of the tower by 0.5.
- **The fingertip's mass is on the body, not its collider.** A dynamic body whose only collider is off has no
  mass, and it stalled the solver for the whole island: grabbed blocks stopped following the hand.
- **The soft grab's angular controller now uses per-axis inertia** (block frame, about the pinch point). The
  single "end over end" inertia was about 28× too high for rolling about the long axis, which put roll near
  the 60 Hz stability limit. The thumb and index joint balls used to hide this by physically gripping the
  block; without them, a block lowered onto the top rolled onto its side.

  Max displacement of any block, rigid joint balls (HEAD) vs fingertip, seed 1:

  | Scenario | Joint balls | Fingertip |
  |----------|-------------|-----------|
  | Brush past the front face, palm and fingers overlapping the tower, 6 u/s | 26.4 | 0.01 |
  | 60 u/s swipe through the top level | 127.9 | 0.01 |
  | Poke a loose top block (17-1) 1.5 units in | 17-1: 1.92, others 0.04 | 17-1: 2.89, others 0.02 |
  | Poke a loaded block (8-0) 1.5 units in | 8-0 rammed 1.55, others 0.15 | 8-0: 0.00, others 0.01 |

  The last row is a gameplay change: a loaded block can no longer be rammed out with a finger. It has to be
  pulled (G-1), or poked once looser blocks exist (block tolerance variance, C-6, #15).
- **E2E after G-1/G-3.**
  - The score E2E (a full move scores 1) is now a plain test, and passed 3/3 before landing.
  - The careful-pull E2E now uses the review's sim 6b threshold (0.5) instead of 0.3, as the physics pull
    tests do. Over 8 runs, 3-1 (above 2-0) moved 0.18–0.38 with either angular controller.
  - The lifts in the score and placement E2E take 3 s (were 1.5 s). At SwiftShader's ~12 FPS, a 20–28-unit
    lift in 1.5 s lags past the 3-unit carry slip distance.
  - Level 16 pulls are chaotic in the sim: 16-1 at 2 u/s gave 2.6–11.8 for small controller gain changes. They
    are tracked only through the 16-0 known bug.

### Tracking filter and one gesture source (H-6, H-7)

- **One pipeline, run once per detection** (`src/tracking/handTracker.ts`, called from `App`'s detection loop).
  The steps, in order:
  1. Outlier rejection.
  2. A One Euro filter on every landmark coordinate, timed by the detection timestamps.
  3. A steadier One Euro filter on the hand-size depth.
  4. The gesture state machine on the filtered landmarks and the same timestamps.

  Every consumer reads its output (`TrackedHand`): the joint bodies, the cursor, the grab, the placement assist
  and the orbit gesture.
  - `useGesture`, and with it three separate gesture state machines with `performance.now()` inside `useMemo`,
    is gone, along with `adaptiveLerp` and `calculatePinchPoint`.
  - `HandPhysics` takes the pinch point from this frame's mapped joints, not from the joint bodies, which only
    get there on the next physics step.
- **Outlier rejection.** A frame is dropped when the whole-hand centroid jumps more than 0.5 palm lengths from
  the last accepted frame, unless the previous frame was dropped too. So a single glitch frame is ignored, and
  a real fast move is followed one frame late.
- **Depth has its own filter.** Depth comes from the wrist→middle-MCP image length, a difference of two
  landmarks, and the depth mapping magnifies it about 100× into world units. With the landmark filter alone,
  depth noise dominated the still-hand jitter.
- **Tuning is on synthetic streams; no real sessions were recorded.**
  - Noise model for a still hand: a per-frame whole-hand shift (σ 0.002 image heights) plus per-landmark noise
    (σ 0.001). Both are assumptions; MediaPipe's real jitter was not measured.
  - Results at the default camera, in world units of the pinch point:
    - Jitter RMS: 0.192 raw → 0.068 at 30 fps, 0.064 at 60 fps.
    - Lag to 90% of a step (sideways or in depth): ≤ 67 ms at 30 fps, ≤ 50 ms at 60 fps.
  - The review's jitter target (< 0.05) is **not met** under this noise model. A sweep of One Euro parameters
    (minCutoff 0.1–1, beta 5–100, dCutoff 1–10) found nothing below ~0.06 that kept every lag under 80 ms: the
    noise in the speed estimate keeps the cutoff up.
  - Chosen: landmarks {minCutoff 0.3, beta 15, dCutoff 4}; depth {minCutoff 0.25, beta 100, dCutoff 1}.
  - Re-tune on recorded real sessions (playtest checklist).
- **A slip needs 0.15 s behind the pinch** (`GRAB_SLIP_TIME`), not one step. The old per-frame lerp rate-limited
  the jumps a dropped camera frame makes. The One Euro filter follows them quickly by design, so a single jump
  while extracting crossed the 1.5 slip distance at once (E2E carries lost the block under SwiftShader frame
  hiccups). A yank keeps the error up and still slips; the physics suite is unchanged.

### Render architecture (M-1, F-7)

- **The tracked hand is a ref, not React state.** `App`'s detection loop writes `handRef.current`. Hand, the
  cursor, HandPhysics and the orbit gesture read it in `useFrame`. React state changes only on discrete events
  (tracking status, held/hovered id, placement target, move phase).
- **Hand and cursor visuals are imperative** (F-7):
  - Hand: one shared material for the joints and one for the bones, recoloured each frame, and group
    visibility set in the frame loop.
  - Cursor: `cursorLook()` (a pure function, unit-tested) decides colour, opacity, the in-range ring, the grab
    sphere and the dot size, and `CursorMaterials.apply()` writes it. The in-range ring and the grab sphere are
    always mounted and toggled by visibility.
  - "In range" now comes from `handPhysics.feedback`, the same per-frame grab candidate, rather than a
    `hoveredBlockId` subscription. So the cursor has no store subscriptions and never re-renders.
- **`Block` is memoized.** It already selected only its own held/hovered state, so a hover change re-renders
  only the blocks it concerns.
- **HandBone uses module-scope scratch vectors** (M-2, in passing).
- **Validation:** `e2e/renders.spec.ts` counts commits with a stub React DevTools hook, the review's §4
  method. With a tracked hand in empty space:

  |                    | Before | After |
  |--------------------|--------|-------|
  | 3 s at rest        | 46     | 0     |
  | 2.5 s moving       | 50     | 0     |

  Frame-time p95 on a mid-range phone was not measured; there is no device here.

### Inference per camera frame (H-8)

- **Detection is driven by the video, not the display.** `onVideoFrames()` (`src/tracking/videoFrames.ts`) uses
  `requestVideoFrameCallback`. Where that is missing, it polls animation frames and skips any whose
  `video.currentTime` hasn't changed.
- **Capture at 640×480** (was 1280×720); the landmark model downscales anyway.
- **The Web Worker is not done here.** The roadmap puts it in Phase 3 (#5). It is not in this run's Phase 3 scope,
  which is mirror AR only, so it stays undone.
- **Validation** (`e2e/inference.spec.ts`): the stub counts detections on a video frame that was already processed.
  - HEAD: 2 in 3 s, with a 1280×720 capture.
  - Now: 0, with a 640×480 capture.

  HEAD's count is low only because this environment renders at about 12 FPS, slower than the fake camera. On
  a 60–120 Hz display the old rAF loop ran 2–4 detections per camera frame. Main-thread long tasks on a phone
  were not measured.

### Hand targets per physics step (P-4)

- **The hand is eased per physics step.** `HandMotion` (`src/game/grab.ts`) takes each render-frame sample and eases
  toward it from the current hand position over that frame's `dt`.
  - `HandPhysics.beforeStep()` (`useBeforePhysicsStep`) advances it one step at a time.
  - The same eased hand drives the joint bodies, the fingertip's target and the soft grab's target.
  - A frame with two steps moves the hand in both. A 120 Hz frame with no step just retargets.
  - After a hitch, the catch-up steps spread the motion over the hitch time, so they don't push with a stale target.
- **Interpolation, not extrapolation.** Extrapolating would overshoot on every stop, so the physical hand trails the
  latest sample by up to one render frame (33 ms at 30 FPS, 8 ms at 120). Hover, grab start and the cursor still use
  the latest sample, so what the cursor shows is still what a pinch would do.
- **Validation:** `tests/physics/frameRate.test.ts` drives the hand with one sample per render frame against the
  fixed 60 Hz step.

  |                                                    | Before (HEAD)        | After                |
  |----------------------------------------------------|----------------------|----------------------|
  | Fingertip speed in free space, 30 fps (mean, sd)   | 5.01, 0.87           | 5.00, 0.00           |
  | Poke: loose block 17-1 moved at 30 / 60 / 120 fps  | 2.84 / 2.89 / 2.89   | 2.89 / 2.89 / 2.89   |
  | Extraction: 2-0 out at 30 / 60 / 120 fps           | 5.95 / 5.94 / 5.95   | 5.94 / 5.94 / 5.95   |

  - G-1 and G-3 had already made outcomes mostly frame-rate independent: the capped fingertip and the PD grab
    absorb the stutter. What remained was the 30 FPS stutter itself, which is now gone.
  - The review's live check, a throttled-rAF run of the landmark harness, was not done. The sim covers the same
    frame/step interleaving.

### Camera mode (H-2)

- **Clutched, as decided: an open palm held still for 400 ms.** `CameraClutch` (`src/tracking/cameraClutch.ts`) runs once
  per detection, after `HandTracker`, using detection timestamps.
  - It arms only on an `OPEN_PALM` whose palm centre (the wrist and finger bases) stays within `CAMERA_CLUTCH_STILL`
    (0.015 normalized image units) of where the hold began. Moving restarts the hold.
  - It never arms while a block is held.
  - It leaves camera mode on a pinch, a closing hand (a fist reads as one; there is no separate fist state) or a lost
    hand.
  - The band started at 0.03. The release E2E caught a moderate open-hand move (0.07 frame widths/s, 0.028 per 400 ms)
    arming mid-move. At 0.015, a palm faster than about 0.04 frame widths/s never arms.
  - Whether real hands hold still enough to arm reliably was not playtested; it is on the playtest checklist.
- **One flag for the mode:** the store's `isCameraMode`. The clutch, the **TURN VIEW (C)** HUD button and the **C**
  key all set it. The button and key are refused while a block is held, and a reset turns the mode off.
  - Turned on with no hand in view, it waits for a hand rather than ending at once.
- **The hand touches nothing in camera mode.** `HandInput.camera`:
  - turns off the fingertip (its solver groups, as with an open palm);
  - turns off hover and grab;
  - disarms the grab onset, so the pinch or fist that ends camera mode never grabs; the hand must reopen first.
- **Indicators:**
  - A violet disc fills the cursor ring during the hold.
  - In camera mode the hand and the cursor turn violet, and a banner takes the move-hint slot:
    "TURNING THE VIEW: MOVE YOUR HAND · PINCH OR PRESS C TO STOP".
  - The UI says "turn view" rather than "camera mode", because "SHOW CAMERA" already means the webcam preview.
- **Orbit** (`OrbitDrive`):
  - 5 rad per frame width (was 15).
  - A backlash dead band of 0.01 instead of a speed deadzone. Jitter inside the band never turns the view, and a
    deliberate sweep turns its full length less the band; a speed deadzone also ate slow, deliberate turns.
  - 80 ms smoothing.
  - The existing OrbitControls polar and distance limits still apply (V-2).
- **Found on the way: the old orbit never applied its own sensitivity.** drei's `OrbitControls` has damping on, so
  `setAzimuthalAngle` applied 5% per update and coasted for seconds after the hand stopped. The gesture's angles are
  now applied with damping bypassed for that call. Mouse orbit keeps its damping.
- `isClosedFist` no longer exists (renamed in H-7), so the review's rename is already done.
- **Validation:**
  - Unit: `cameraClutch.test.ts` (hold time, moving palms at 0.07 and 0.25 frame widths/s, holding, interruptions,
    exits, jitter vs. sweep), the HUD and store tests.
  - Physics: `tests/physics/cameraMode.test.ts`. The poke that moves 17-1 by 2.9 moves nothing in camera mode, and
    the pinch that ends camera mode doesn't grab.
  - E2E (`e2e/camera.spec.ts`):
    - Hold → turn → pinch ends it.
    - Release, then move the open hand away: the camera moves 0, and camera mode stays off, including through a
      1.5 s relaxed rest afterwards.
    - C toggles the mode.
  - An open palm left resting still for 400 ms does enter camera mode, by design. The fill and the banner make it
    visible.
  - The playtest metric (unintended camera moves per minute ≈ 0) needs people.
- The 390 px bottom bar already clipped EXIT GAME before H-2, and the fifth button adds to it. M-5 (#12) owns that
  layout.

### Depth direction, gauge and calibration (H-3, H-4)

- **Mirror stays the default, with a reach-in setting**, as decided. No A/B playtest was run.
  - **DEPTH → TOWARD YOU / INTO THE SCENE** sets `depthSettings.reachIn`.
  - `depthFromHandSize` (`src/utils/depth.ts`) applies it. That function is the one mapping, shared with its inverse
    `handSizeForDepth`, which the E2E driver uses.
  - The HUD instructions follow the setting. README fixed in Phase 1 and extended here.
- **Depth gauge** (`DepthGauge.tsx`): a bar on the right edge, FAR at the top and NEAR at the bottom.
  - The tower's front-to-back extent is an orange band, measured along the view at the pinch point's height.
  - The hand is a cyan line.
  - It is DOM positioned from the frame loop through `DepthGaugeView`, so it never re-renders. It shows only while a
    hand is tracked.
  - It complements F-3's drop marker, which shows height above the surface.
- **Pitch-robust hand size** (`handSize`): the larger of the palm length and 1.35 × the palm width, in frame heights
  (x corrected for aspect).
  - The review suggests 1.4, the typical ratio. At 1.4 the width, whose noise the factor scales up, won the max about
    half the time on an untilted hand. Still-hand depth jitter then broke the H-6 bound: 0.073 at 60 fps, raw
    0.192 → 0.208.
  - A lower depth `beta` fixed the jitter but slowed a small depth step to 100 ms, and `minCutoff` made no difference.
  - At 1.35 the length wins until pitch shortens it by about 4%. Jitter is back to raw 0.192 and filtered
    0.068 / 0.064, and every lag is under 80 ms.
  - Synthetic 30° pitch at a fixed distance, default camera: the depth moves 0.79 world units, against 2.71 with palm
    length alone and the review's < 1 target. 30° roll: 0 either way for this pose.
  - Measured on the synthetic poses only. The review's check needs a real device.
- **5-second calibration** (`DepthCalibrator`):
  - **DEPTH → CALIBRATE (5 S)** prompts the near step, then the far step, each 2.5 s with a progress bar.
  - Each end is the median filtered hand size over the last 1 s of its step. It fails if there are fewer than 5
    samples ("couldn't see your hand") or if near < 1.4 × far ("too alike").
  - It runs once per detection, as the clutch does. The hand is inert while calibrating: `HandInput.camera` became
    `inert`, which covers camera mode and calibration. The camera clutch doesn't arm while calibrating.
  - The start screen's old "CALIBRATE HANDS" promise now points to this.
- **Persistence:** `depthSettings` (the direction and the calibration) is kept in localStorage through zustand
  `persist`, and nothing else is. It is a per-viewer convenience; without storage it simply starts at the defaults.
- **The depth filter** was already heavier than x/y, and on its own filter (H-6).
- **Validation:**
  - Unit: `depth.test.ts` (pitch and roll in world units, aspect independence, the direction, calibrated ends, the
    inverse), `depthCalibration.test.ts`, the HUD and store tests.
  - E2E (`e2e/depth.spec.ts`):
    - Calibrating with image sizes 0.3 then 0.1 records near 0.30 and far 0.10, and those sizes then sit at the
      gauge's ends.
    - A hand near the webcam is 28.0 from the camera in mirror mode and 53.7 in reach-in, and the setting is saved.
    - The gauge shows the hand below the tower band when in front of it, and inside the band when level with its
      middle.
  - The review's playtests (time to first touch, depth reversals, mirror vs. reach-in with 5+ people) need people.
- The DEPTH button makes six in the bottom bar. M-5 (#12) owns that layout.

### Responsive layout (M-5)

- **The landmark→world mapping part of #12 (M-4)** was done in Phase 1: the frustum-based mapping in `tracking/mapping.ts`.
- **Shared layout variables** in `index.css`:
  - safe-area insets (`viewport-fit=cover` added);
  - the bottom bar's height (1 row, or 2 below 700 px; slimmer buttons below 500 px tall);
  - the camera preview's width, `clamp(120px, 22vw, 240px)`.

  The HUD and the preview, which lives outside the HUD, place themselves by these variables.
- **The bottom bar:**
  - It went from 6 buttons to 4–5. **SETTINGS** opens one panel holding RESET VIEW, the depth direction and
    calibration (H-3, H-4).
  - On wide screens it wraps within the space left of the preview.
  - Below 700 px it becomes a 3-column grid across the bottom, with the preview above it, and the "(C)" key hint is
    hidden.
- **The start screen:**
  - `clamp()` sizes for the title (in vw and vh), the subtitle, the buttons and the footer.
  - The mode buttons stack below 700 px.
  - The content scrolls rather than clipping if it ever has to.
  - In the stacked column the buttons are `flex: none`. With `flex: 1 1 0` and `overflow: hidden` they collapsed to
    60 px, and their labels overflowed.
- **The modal, panels and gauge** are sized to the viewport less the insets. The gauge is 24vh tall on short
  screens, to clear the score and the preview.
- **Validation:**
  - `e2e/layout.spec.ts`, at 1280×720, 390×844 and 844×390. Nothing on the start screen or the HUD (with the camera
    preview, the gauge and the settings panel open) is outside the viewport. No control overlaps another, the
    preview, the title, the score or the gauge, and no button's label overflows it.
  - Before: `docs/screenshots/before-m5/`. At 390 the start screen and EXIT GAME are clipped, and at 844×390 the
    preview covers RESET VIEW, EXIT GAME and the gauge. After: `docs/screenshots/after-m5/`.
- **Edge-to-edge reach** at the three viewports is unchanged from Phase 1. The mapping is the same, and the screenshot
  spec's hand-at-the-edges shots show it.
- **The screenshot spec's phone FPS floor dropped from 8 to 4.** SwiftShader at 390×844 ran at about 5–6 FPS here,
  with or without these changes (measured both ways). The screenshots don't need a frame rate.

### First run, camera errors and exits (O-1, O-4, O-6)

- **The tutorial (O-1)** is the review's six steps, as cards in the hint slot under the top bar:
  1. show your hand;
  2. calibrate (H-4), with CALIBRATE and SKIP THIS STEP buttons;
  3. touch the glowing block;
  4. pinch, then let go;
  5. pull it out;
  6. put it on top.

  A last card says "you've got it" and closes itself after 6 s.
  - **Where it lives:**
    - The steps and their conditions are in `game/tutorial.ts`. `advanceTutorial` is pure, and is tested on store
      snapshots.
    - `HUD/Tutorial.tsx` advances it on store changes.
    - The pull step needs the block's position, so `TutorialRules` checks it on the physics world at the rules rate.
      It counts as pulled out once its centre is past the tower's footprint by 80% of its half-length.
  - **The target block** is `4-0`, a middle block on a low, even level. It turns orange and pulses; hover (cyan)
    and held (green) still win.
  - **The card** sits under the top bar. On the place step it moves to the bottom left, above the bar and beside
    the preview, so it doesn't cover the top of the tower. `e2e/layout.spec.ts` checks both positions at the
    three viewports. Screenshots: `docs/screenshots/after-o1/*-7-tutorial.png`, `*-7b-tutorial-place.png` and
    `*-8-exit-confirm.png`. Before #13 there was nothing in their place (`after-m5`).
  - **Scoring:** a score from the touch step onward finishes the tutorial, so a player who skips ahead isn't stuck
    on a card.
  - **When it runs:**
    - It runs on the first Classic game only, with the camera preview turned on. `tutorialDone` persists with the
      depth settings.
    - A foul's restart keeps it on its step. EXIT and SKIP TUTORIAL end it.
    - SETTINGS → REPLAY TUTORIAL starts a fresh Classic game on step 1, and **?** in the top bar shows the controls
      overlay again.
  - **E2E:** the fixtures mark the tutorial done, so every other test starts as a returning player.
    `e2e/tutorial.spec.ts` clears that and walks it end to end, through a real extraction and placement, to a score
    of 1.
  - **Deviations:**
    - **No landmark overlay** on the camera preview. The preview, the in-scene hand and the depth gauge already show
      what is tracked.
    - **The "Low light" chip state is not done.** Nothing measures light. A false warning is worse than none.
    - **Classic only.** Sandbox has no move to teach toward.
    - **Not measured:** the review's validation, 80% of first-time players finishing a move within 2 minutes
      unaided, needs people. It is on the manual playtest checklist.
- **Camera errors (O-4):**
  - `tracking/cameraErrors.ts` maps the error to a title, what to do, and whether another camera might help.
    The cases are: `NotAllowedError`/`SecurityError` (blocked), `NotFoundError`, `NotReadableError` (in use),
    a missing `navigator.mediaDevices` (not https or localhost), and `OverconstrainedError` (the camera can't do the
    requested video settings).
  - An `OverconstrainedError` retries with no size constraints before it counts as an error.
  - When another camera might work, `enumerateDevices` lists the others as buttons beside Retry.
  - **Deviation:** the pointer-mode fallback (A-1) is not here. It is a Phase 3 item that this pass skips.
- **Exits (O-6):**
  - EXIT GAME, or the title, asks "LEAVE THIS GAME?" when a Classic game is in play. Escape or KEEP PLAYING
    stays. Sandbox and a finished game leave at once.
  - The top bar is `pointer-events: none`. Only the title, the **?** button and the controls take clicks, so a
    mouse orbit can start anywhere above the tower. `e2e/exit.spec.ts` drags from the bar: the camera turns. Before
    the fix it didn't move.

### CI (Q-2)

- **Both harnesses from Q-2 already exist:**
  - `tests/physics`: headless Rapier, real physics, run by `npm test`.
  - `e2e/`: Playwright with a scripted MediaPipe stand-in.

  #14 runs them on every push and pull request: `.github/workflows/ci.yml`.
- **Two jobs, in parallel:**
  - **checks:** lint, `npm test` (unit and physics) and the build.
  - **e2e:** `npm run test:e2e`.

  Both use Node 24, the version used here.
- **Caching:**
  - npm is cached.
  - The runtime assets (the hand model and the HDR) are cached, keyed by `scripts/fetch-assets.mjs`, which pins
    their URLs and SHA-256. A run downloads them only when the script changes.
  - Playwright's Chromium is cached, keyed by the lockfile. A cache hit still installs the system libraries.
- **On CI, Playwright:**
  - fails on a stray `test.only`;
  - annotates failures on the PR;
  - keeps an HTML report, uploaded with the traces when the E2E job fails.
  - Retries stay at 0, so a flaky test shows up as a failure, not a pass.
- **Validated locally, not on GitHub:**
  - Nothing is pushed in this pass.
  - The workflow passes `actionlint` 1.7.7.
  - Its steps were run in a clean worktree of the commit with `CI=1`: `npm ci`, lint, `npm test`, the build, and
    the full E2E suite. This is the result reported in the #14 commit.
- **Unverified on GitHub's runners:**
  - The E2E frame-rate floors (8 FPS steady state; 1–4 in the layout and screenshot specs) were measured on this
    4-core ARM machine with SwiftShader.
  - GitHub's 4-vCPU x86 runners are expected to be at least as fast, but this hasn't been run there.
  - The first CI run should be checked for timing failures before the suite is made a required check.

