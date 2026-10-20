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
