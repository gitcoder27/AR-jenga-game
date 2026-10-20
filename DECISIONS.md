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
