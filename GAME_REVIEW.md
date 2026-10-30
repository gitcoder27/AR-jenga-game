# AR Jenga — End-to-End Game Review

**Date:** 2026-10-20 · **Commit reviewed:** `0b838bd` (main) · **Scope:** whole repo, read-only (no application code changed)

---

## 0. How this review was done (read this first)

The game is a **webcam + MediaPipe hand-tracking game** rendered with React Three Fiber and Rapier physics. It is **not WebXR AR**. There is no surface detection, no device-pose tracking and no camera-feed compositing. The webcam image only appears as an optional 240×135 preview, and the play space is a virtual studio and table. So the prompt's AR topics are reviewed as their nearest equivalents here:

| Prompt topic | What it means in this codebase |
|---|---|
| AR onboarding | Start screen → camera permission → model load → first hand detection |
| Surface detection & placement | The fixed virtual table and tower; placing a block on top of the tower |
| Camera tracking | MediaPipe hand tracking, plus the virtual camera (OrbitControls and "open-palm" gesture orbit) |
| Touch gestures | None for gameplay. Hand gestures (pinch, open palm) are the gameplay input; touch only drives OrbitControls |

**Methods used**

1. **Full code read** of every file in `src/`, plus docs and configs.
2. **Toolchain:** `npm ci`, `npx vitest run`, `npm run lint`, `npm run build`.
3. **Headless physics replica.** A Node script uses the *same* Rapier build the app ships (`@dimforge/rapier3d-compat 0.12.0`). It reproduces the app's exact floor, table, tower, block and hand colliders, materials, Grab logic and `@react-three/rapier` 2.2 default integration parameters. It ran 10 scenarios (idle stability, grab queries, tracking loss, pulls, collapse timing, glitches, gravity).
4. **Real app in headless Chromium (Playwright 1.63).** The fake webcam was `--use-fake-device-for-media-stream`, with Vite in dev mode:
   - *Pass 1:* real MediaPipe pipeline (network, console, readiness), start screen at desktop and phone sizes, camera-denied and no-camera flows, webcam lifecycle, React commit counting.
   - *Passes 2–4:* **scripted play.** Playwright replaced the MediaPipe module served by Vite with a stand-in whose `detectForVideo()` returns scripted 21-landmark hand poses. That let me hover, pinch, pull, carry and drop tracking in the real app. I read live game state through Vite's module URL (`/src/store/gameStore.ts`) and block positions through R3F's `_roots` scene graph.
   - *Pass 5:* failure modes (CDN asset blocked, model blocked), portrait phone layout, keyboard navigation.

**Evidence labels used on every finding**

- ✅ **Verified (live)**: reproduced in the running app.
- ✅ **Verified (sim)**: reproduced in the headless Rapier replica.
- 🔎 **Code-confirmed**: deterministic from reading the code or library source; not dependent on runtime conditions.
- ❓ **Suspected**: plausible from the code, but not reproduced; needs device or playtest confirmation.

**Finding types:** Confirmed bug · Suspected issue · UX improvement · Feature opportunity.
**Priority:** P0 (breaks the core loop, crashes, corrupts a game) · P1 (major friction) · P2 (moderate) · P3 (polish).
**Effort:** S (≤ ½ day) · M (1–3 days) · L (1–2 weeks) · XL (> 2 weeks).

### What I could not test

- **Real hands and a real webcam.** The server has no camera. The real MediaPipe model *did* load and run in headless Chromium on Chrome's synthetic video, but no human hand was ever tracked. Real-world landmark noise, lighting sensitivity, latency and accuracy are therefore **not measured**. Gesture conclusions come from the app's own classifier code run on synthetic but anatomically plausible poses, and from scripted play.
- **Real GPU frame rates.** Headless Chromium used software rendering (SwiftShader) at about 2 FPS (1280×720) and about 12 FPS (640×360). Absolute FPS numbers are meaningless here. I report **relative** costs instead (React re-render counts, redundant inference calls, physics ms per step).
- **Physical devices.** I did not test iOS Safari, Android Chrome, real touch, thermals or long sessions.
- **Screen readers.** No screen-reader testing was done. I checked keyboard focus order only.
- **Chaos in the physics results.** The physics replica matches the app's parameters, but tower physics is chaotic, so exact numbers vary by random seed. I state trends that held across runs, and quote the actual numbers.

---

## 1. Executive summary

**Overall verdict.** The foundations are sound:

- The tower stands still. All 54 blocks fall asleep, with ≤ 0.08 units of settling, across 5 seeds.
- Physics is cheap at about 0.2 ms per step.
- When the virtual hand is settled next to a block, pinch-grabbing works. It succeeded 8/8 times live.
- The component and hook split is clean.

**But the core Jenga loop cannot currently be completed, and several reliability bugs can destroy or crash a game:**

1. **You cannot score.** `incrementScore()` and `setHeldBlockId()` are never called anywhere. Score is always 0, and the "held"/"safe" logic is dead code (C-1, C-2).
2. **You can't see or reach the top of the tower.** That is where blocks have to be placed. At the default camera the top is off-screen *and* outside the hand's reach. Only 5.6% of camera setups make it both visible and reachable, and those need a 2× mouse-wheel zoom plus a near top-down orbit (C-3).
3. **Losing tracking while holding a block wrecks the tower.** The held block is yanked toward y = −100 at about 7,500 units/s, through the tower and the floor. Live, the block ended at y = −244 (H-5).
4. **Resetting while holding a block crashes the physics engine.** Rapier's WASM panics (`unreachable`), and with no error boundary the canvas unmounts to a black screen (G-8).
5. **The gesture classifier depends on how far your hand is from the webcam.** In the depth band needed to reach the tower, a relaxed open hand is classified as "open palm" and the camera starts orbiting. A far-away hand can't release a pinch, and a fist counts as a pinch. Accidental orbits happened in 2 separate scripted runs (H-1, H-2).
6. **The physics rewards yanking and punishes care.** A rigid fixed joint to an infinite-mass kinematic fingertip, plus friction 1.0, means a *slow, careful* pull of a centre block collapsed the upper tower in simulation and in the live app. Fast yanks didn't (G-1, G-2).
7. **Visual feedback doesn't work.**
   - Block hover highlight never appears: the block name is read from a field `@react-three/rapier` never sets (F-1).
   - The cursor's "in range" ring never shows: it measured distance to the block centre instead of its surface (F-2).
   - Nothing casts shadows (F-3).
8. **Fragile startup.** About 13 MB of runtime downloads come from three CDNs with no loading or error UI. If the HDR environment map fails to load, the whole app blanks (O-2, O-3).
9. **Performance architecture.** Every detection frame calls `setState` at the app root, which re-renders all 54 `Block` components, even with no hand in view. MediaPipe also runs on the main thread on every animation frame, whether or not a new video frame arrived (M-1, H-8).
10. **Mobile is not playable.** In portrait, horizontal hand sensitivity is about 3× too high, and the hand leaves the screen almost immediately. The start screen is clipped at 390 px, and the HUD overlaps the camera preview (M-4, M-5).

**Recommended order of work.** Follow the roadmap in §3:

1. Crash and integrity fixes (all small).
2. Make the core loop completable: camera framing, reach, placement assist, scoring.
3. Interaction feel: soft grab, friction, filtering, scale-invariant gestures, an orbit gesture that doesn't collide with grabbing.
4. Feedback and onboarding.
5. Performance and mobile.
6. New features.

### Top findings at a glance

| ID | Finding | Type | Pri | Effort | Evidence |
|---|---|---|---|---|---|
| H-5 | Tracking loss while holding yanks the block through the tower and floor | Confirmed bug | P0 | S | ✅ live + sim |
| G-8 | Reset while holding → Rapier WASM panic → black screen | Confirmed bug | P0 | S | ✅ live (stack trace) |
| C-1 | Score never increments; no definition of a completed move | Confirmed bug | P0 | M | 🔎 + ✅ live |
| C-2 | `heldBlockId` never set: held highlight, "safe" logic and floor rule all broken | Confirmed bug | P0 | S | 🔎 + ✅ live |
| C-3 | Top of tower off-screen and out of reach at default camera | Confirmed bug | P0 | M | ✅ geometry + screenshots |
| H-1 | Gesture thresholds aren't scale-normalized; misclassify at the depths needed to play | Confirmed bug | P0 | S–M | ✅ live + app classifier |
| G-1 | Rigid joint to infinite-mass finger: careful pulls collapse the tower | Confirmed bug (design) | P0 | M | ✅ live + sim |
| F-1 | Hover highlight can never trigger | Confirmed bug | P1 | S | 🔎 lib source + ✅ live |
| F-2 | Cursor "in range" feedback never shows (0/807 grabbable points) | Confirmed bug | P1 | S | ✅ sim |
| H-2 | Open palm = camera orbit, which collides with the natural release/neutral pose | UX | P1 | M | ✅ live |
| G-2 | Friction 1.0 drags neighbouring blocks out with the one you pull | Suspected issue → sim-confirmed | P1 | S | ✅ sim |
| O-3 | HDR from raw.githack; if blocked, the whole UI unmounts | Confirmed bug | P1 | S | ✅ live |
| O-5 | Webcam stays on after exiting during camera start-up | Confirmed bug (privacy) | P1 | S | ✅ live |
| M-1 | Per-frame root re-render of all 54 blocks | Confirmed perf issue | P1 | M | ✅ live (render counts) |
| M-4 | Portrait mobile: hand mapping ignores the camera's aspect ratio | Confirmed bug | P1 | S–M | ✅ live screenshot |

---

## 2. Detailed findings

Each finding uses the same structure: **Type · Priority · Effort · Evidence**, then *Impact*, *Repro / evidence*, *Likely cause*, *Recommended fix*, *How to validate*.

### 2.1 Core loop & game rules

#### C-1 — Score never increments; there is no "successful move" rule
**Confirmed bug · P0 · M · 🔎 + ✅ live**

- **Impact:** Classic mode has no progression and no win or lose stakes beyond collapse. The final score is always 0, and players get no reward for a successful extraction.
- **Repro / evidence:**
  - `incrementScore` is defined in `src/store/gameStore.ts:45` but has **no call sites** (`grep -rn incrementScore src` → store and tests only).
  - Live scripted play: after successfully extracting `block-2-0` (it moved 5.7–6.2 units with the hand in 9 separate grabs), `score` stayed `0`.
- **Likely cause:** The scoring rule was never implemented. There is no concept of a move lifecycle (pick → extract → place on top → stable).
- **Recommended fix:** Add a small move state machine in the store: `IDLE → HOLDING(blockId, originLevel) → PLACED(candidate) → SETTLING(t) → SCORED | FOUL`.
  - Score +1 when the moved block rests above the previous top layer and the tower stays stable for N seconds. "Stable" means all bodies asleep, or the maximum linear velocity stays below ε for about 3 s.
  - Award a "clean extraction" bonus if no other block moved more than 0.3 units during the move.
- **Validate:**
  - Unit-test the state machine with the headless Rapier replica (§4): script an extraction and placement, then assert score = 1. Script a collapse and assert no score.
  - Add a Playwright E2E test with scripted landmarks that asserts `useGameStore.getState().score === 1`.

#### C-2 — `heldBlockId` is never set, so held highlight, "safe" blocks and the floor rule are all dead
**Confirmed bug · P0 · S · 🔎 + ✅ live**

- **Impact:**
  - A held block never turns green (`Block.tsx:42-45`).
  - `isSafe` is never true (`Block.tsx:53-57`).
  - In Classic mode, **dropping the block you are carrying onto the floor ends the game.** The `id !== heldBlockId` check at `Block.tsx:64` compares against `null`.
- **Repro / evidence:** `setHeldBlockId` (`gameStore.ts:46`) has no call sites. Grabbing and releasing happen in `Hand.tsx:163-238` without ever touching the store. Live: `heldBlockId === null` throughout every successful grab and carry.
- **Likely cause:** The grab code was written against Rapier handles, and nobody connected it back to the store.
- **Recommended fix:**
  - On joint creation, resolve the block id (see F-1 for the id lookup) and call `setHeldBlockId(id)`.
  - On release (and on tracking loss, reset or unmount), call `setHeldBlockId(null)`.
  - Rework "safe" so it means "this is the block currently being moved this turn", not "ever held".
- **Validate:**
  - E2E: the store reports `heldBlockId === 'block-2-0'` during a carry, and `null` after release.
  - Visual: the held block tints green.
  - Classic: dropping the carried block off the table should be a foul or a re-try, not an instant game over (decide the rule; see C-4).

#### C-3 — The top of the tower is off-screen and out of reach at the default camera
**Confirmed bug · P0 · M · ✅ geometry (using the app's exact mapping) + screenshots**

- **Impact:** Placing the extracted block on top, which is half of every Jenga turn, is effectively impossible without hidden mouse-wheel zoom and orbit gymnastics. Players can see only the bottom roughly 60% of the tower (see the `classic-no-hand` and portrait screenshots: the top levels are cut off).
- **Repro / evidence:**
  - The camera is at `[0,10,20]` (`App.tsx:59`), and OrbitControls targets the origin (`App.tsx:72`, default target). The tower is 18 × 1.5 = 27 units tall.
  - The hand's reachable depth is fixed **12–28 units in front of the camera**: `lz = -(BASE_DIST − handZ)` with `BASE_DIST = 20` and `handZ ∈ [−8, 8]` (`Hand.tsx:111-132`, `depth.ts:23`).
  - Using the app's inverse mapping:

    | Point | Depth from camera | Reachable? | On screen? |
    |---|---|---|---|
    | Top placement point (0, 27.75, 0) | 10.0 | **No** | **No** |
    | Level 17 front face | 7.2 | **No** | **No** |
    | Level 9 front face | 12.5 | yes | **No** |
    | Level 6 front face | 14.6 | yes | yes |
    | Level 2 front face | 17.2 | yes | yes |

  - A sweep of 2,448 orbit setups (elevation −10…89°, distance 10…80, 16:9 and 9:16) found the top placement point both visible and reachable in only **138 (5.6%)**. All of them need a zoom to distance 40–54 (about 2× the default, mouse wheel only; there is no gesture zoom) **and** a near top-down view at 65–89° elevation.
- **Likely cause:** The camera targets the floor centre rather than the tower. The hand's interaction volume is anchored to the *camera* at a fixed depth, so it doesn't follow the tower when the camera zooms or orbits.
- **Recommended fix:**
  1. Frame the tower: OrbitControls `target = [0, ~12, 0]`, camera at about `[0, 18, 34]`, and an FOV of about 50° so all 27 units fit with headroom. Re-frame as the tower grows.
  2. Make the interaction volume **target-relative**: set `BASE_DIST = controls.getDistance()` each frame, and scale the depth range with distance. Then zoom and orbit never break reach.
  3. Add a **placement assist**: when a held block's centre is above the top layer and within about 1 block width, show a ghost block snapped to the next valid slot (correct yaw for the layer). Releasing near it snaps with a short ease (see G-6).
  4. Optionally add an auto "placement view": when the player lifts a held block above the tower's mid-height, ease the camera up to look at the top.
- **Validate:**
  - Re-run the reachability sweep (§4) as a unit test: the top placement point must be reachable and visible at the default camera, *and* across the allowed orbit range.
  - Playtest: time from extraction to successful placement under 10 s, and over 80% placement success for first-time players.

#### C-4 — Game-over detection: floor-only, about 2 s late, and blind to blocks landing on the table
**Confirmed bug (rules) · P1 · M · 🔎 + ✅ sim**

- **Impact:**
  - The "TOWER COLLAPSED" modal appears about 2 seconds after the collapse is obvious.
  - A block knocked out that comes to rest on the table never ends the game. The table's margin around the tower is about 1.2 units, since the table half-width is 5 and the tower half-width is about 3.8.
  - A carried block touching the floor *does* end the game (see C-2).
- **Repro / evidence:**
  - Rule: `Block.tsx:59-68`. GAME_OVER happens only when a non-held, non-safe block collides with the body named `floor` (y ≈ −4.5, outside the 10×10 table).
  - Sim 7c: the first block was clearly dislodged at **0.55 s**, and the first floor contact (i.e. GAME_OVER) came at **2.58 s**.
  - Sim 7b: a single top block pushed off hit the floor 2.6–3.1 s later.
- **Likely cause:** Floor contact stands in for "a block fell". Real Jenga rules are about *any* block other than the one being moved falling from the tower.
- **Recommended fix:** Implement a per-frame rule check (run it after each physics step, at most 10 Hz, ideally with `useAfterPhysicsStep`):
  - **Foul** if any block other than the held one leaves its "tower slot band": its centre is more than 0.5 block-height below its spawn level, or more than 1 block-width outside the footprint. The same applies if it contacts the table or floor while outside the footprint.
  - **Collapse** if the tower's top height drops by more than 1 level.
  - Fire immediately; don't wait for floor contact. Optionally play a 1–2 s slow-motion beat before the modal.
- **Validate:** Sim tests for pushing a top block off, pushing a lower block onto the table, and full collapse. Assert the foul fires within 0.5 s of the event and never fires during a clean extraction.

#### C-5 — No real Jenga rules, turns, timer or best score
**Feature opportunity · P2 · M–L · 🔎**

- **Impact:** Even once the loop works, it's a physics toy rather than a game. There is no goal structure, no replay incentive, and no local multiplayer, which is how Jenga is normally played.
- **Recommended fix:** Implement classic rules in order:
  1. Take from any level below the highest completed level.
  2. Place on top, completing the level before starting a new one.
  3. The turn ends when the tower is stable for 5–10 s.
  4. One hand only (already true).

  Then add pass-the-device turns with player names, a persistent best score (`localStorage`), and an optional per-move timer.
- **Validate:** Playtest retention: share of sessions with more than 3 moves, and number of repeat games.

#### C-6 — All 54 blocks are identical, so there are no "loose" blocks
**Feature opportunity · P2 · S–M · 🔎**

- **Impact:** Jenga's core skill is *probing* for loose blocks. Here every block carries an equal share of load (`Tower.tsx:9-48`). Only ±0.025 position jitter and ±0.01 rad yaw jitter exist, with no height or width variance, so no block is meaningfully easier than another.
- **Recommended fix:** Give each block a seeded height variance of about ±1–2% (scale the collider and mesh `y`) and a width variance of about ±1%. A few blocks per level then carry no load. Seed it so towers are reproducible, and use the seed for difficulty presets.
- **Validate:** In sim, measure per-block normal force at rest, or "pull force needed". Expect a spread where 1–3 blocks per level slide out with little disturbance.

---

### 2.2 Hand tracking & gestures

#### H-1 — Gesture thresholds use absolute image distances, so classification changes with hand distance
**Confirmed bug · P0 · S–M · ✅ app classifier + ✅ live**

- **Impact:** The same physical hand pose means different things depending on how close it is to the webcam. Because depth *is* hand size (`depth.ts`), the problem is worst exactly where the tower is:
  - Accidental camera orbits while reaching for blocks.
  - Phantom grabs when the hand is far away.
  - Being unable to release when far away.
- **Repro / evidence:**
  - Thresholds: `gestureState.ts:14-19`: pinch enter < 0.06, exit > 0.10, finger extension > 0.28, spread > 0.08, all in **normalized image units**.
  - I ran the app's own `calculateGestureMetrics` and `transitionGestureState` in the browser on synthetic poses at palm size `s` (wrist→middle-MCP distance, the same quantity `depth.ts` uses):

    | palm size s | half-open claw (tips 0.9 palm apart) | relaxed open hand | fist |
    |---|---|---|---|
    | 0.06 (hand far → deep in scene) | **PINCH** | holds previous state (*can't release*) | PINCH |
    | 0.10 | holds previous state | idle | PINCH |
    | 0.15–0.20 | idle | idle | PINCH |
    | 0.25 | idle | **OPEN_PALM → orbit** | PINCH |
    | 0.30 | idle | **OPEN_PALM → orbit** | PINCH |
    | 0.35 | **OPEN_PALM → orbit** | **OPEN_PALM → orbit** | PINCH |

  - Reaching the tower's front face needs s ≈ 0.245 (level 2) to 0.30 (level 6). That is exactly where a relaxed hand becomes "open palm".
  - **Live:** in two scripted runs, the camera orbited by itself while the hand approached the tower in a curled or claw pose (the camera position drifted on every attempt). That moved the camera-relative hand off target.
- **Likely cause:** Thresholds were tuned at one comfortable distance and never normalized by hand scale.
- **Recommended fix:**
  - Divide every distance by a per-frame hand scale: `palm = max(|lm0−lm9|, |lm5−lm17| × 1.4)`, smoothed.
  - Pinch: `pinchDist / palm < 0.25` enter, `> 0.40` exit (tune).
  - Finger extension: use **joint angles** (PIP/DIP curl from 3 consecutive landmarks) instead of distance to the wrist. This also stops a fist from reading as a pinch.
  - Alternatively, use MediaPipe `worldLandmarks` (metric, scale-invariant) for gesture metrics and image landmarks only for position.
- **Validate:** Add a classifier unit test. For each canonical pose, assert an identical classification for s ∈ [0.06, 0.40]. Then confirm the accidental-orbit rate is 0 in the scripted E2E approach.

#### H-2 — "Open palm = orbit camera" collides with the natural release and neutral pose
**UX improvement · P1 · M · ✅ live + 🔎**

- **Impact:**
  - After releasing a block, people naturally open their hand. After the 200 ms cooldown plus 80 ms debounce (`gestureState.ts:22-25`), any hand motion then spins the camera with no warning.
  - Because the hand mapping is camera-relative, the hand *moves through the scene* when the camera rotates.
  - The hand keeps its colliders in camera mode. Live, an open-palm orbit near the tower knocked it over and triggered GAME_OVER.
  - The gesture is undocumented: the HUD says "STEADY HAND TO MOVE" (`HUD.tsx:45`), and the README doesn't mention it.
- **Repro / evidence:** `GestureOrbitController.tsx:21-45`. Sensitivity is 15 rad per normalized unit (line 12), so moving the hand a quarter of the frame rotates about 215°. There is no smoothing, no deadzone and no polar limit.
- **Recommended fix:** Make camera control **deliberate** and **clutched**. Pick one:
  - (a) Hold an open palm still for 400 ms to enter "camera mode": show a clear mode indicator, make hand colliders sensors, and exit on fist or pinch.
  - (b) Use two-hand orbit, so only the second hand controls the camera.
  - (c) Use an explicit HUD toggle or a key.

  Also:
  - Lower sensitivity to about 4–6 rad per frame-width, with a deadzone and smoothing.
  - Clamp the polar angle (V-2).
  - Rename `isClosedFist`, which actually means open palm (`useGesture.ts:22,97`).
- **Validate:** Playtest metric: unintended camera moves per minute should be about 0. Scripted E2E: a release followed by moving an open hand doesn't change `camera.position`.

#### H-3 — Depth direction contradicts the README; neither choice has been playtested
**UX improvement (confirmed docs/code inconsistency) · P1 · S · 🔎**

- **Impact:**
  - The README says "Move your hand closer to the camera to reach forward into the scene".
  - The code does the opposite: a bigger hand (closer to the webcam) gives `handZ → +8`, so `lz → −12`, which puts the virtual hand *nearer the viewer* (`depth.ts:23`, `Hand.tsx:132`). That is a mirror metaphor.
  - Users who read the README, or who intuitively "reach into the screen", will move the virtual hand away from the tower.
- **Recommended fix:**
  - A/B playtest "mirror" (current) against "reach-in" (negate `handZ`), then pick one and fix the README and HUD copy.
  - Whichever wins, add a **depth gauge**: a vertical bar or a shadow/ray from the hand to the tower surface (see F-3), so depth is perceivable.
- **Validate:** Playtest with 5+ users: time-to-first-touch of a named block, and number of depth reversals (the hand overshoots then corrects).

#### H-4 — Depth from 2D wrist→MCP length: sensitive to hand pitch and size; no calibration
**Suspected issue · P1 · M · 🔎**

- **Impact:**
  - Tilting the hand (fingers toward the webcam) shortens the 2D wrist→MCP distance, so the virtual hand jumps deeper while the real hand hasn't moved.
  - Different hand sizes (child versus adult) get different reach.
  - The start screen promises "CALIBRATE HANDS FOR BEST EXPERIENCE" (`StartScreen.tsx:35`), but no calibration exists.
- **Repro / evidence:** `depth.ts:10-23` uses only the 2D distance between landmarks 0 and 9, clamped to [0.02, 0.35]. That mapping is a ×48 gain from normalized length to world units.
- **Recommended fix:**
  - Add a 5-second **calibration step**: "hold your hand comfortably near, then far". Record `palmNear` and `palmFar`, and map that range to the depth range.
  - Use a pitch-robust scale: the maximum of palm length and 1.4 × palm width (landmarks 5–17), or `worldLandmarks` z.
  - Filter depth more heavily than x/y (One Euro with a lower min-cutoff).
- **Validate:** Rotating the hand 30° in pitch at a fixed distance moves the virtual hand by less than 1 unit (needs a real device). Calibrated users with different hand sizes reach the same front and back extents.

#### H-5 — Losing tracking while holding a block yanks it through the tower and floor
**Confirmed bug · P0 · S · ✅ live + ✅ sim**

- **Impact:** Brief tracking dropouts are routine (fast motion, the hand leaving the frame, occlusion, lighting). If one happens while carrying a block, it destroys the tower and loses the block.
- **Repro / evidence:**
  - `Hand.tsx:96-105`: when landmarks disappear, the frame returns early. It parks every joint at `(0,−100,0)` via `setNextKinematicTranslation` and **skips the release branch** (`Hand.tsx:226-238`), so the fixed joint stays attached to the thumb, which is now heading to y = −100.
  - Sim 4: a block carried above the tower, with tracking lost for 3 frames, reached a peak speed of **7,560 units/s**, passed through the tower (**47 other blocks displaced by more than 0.25 units**), and tunnelled through the floor without even raising a floor collision event.
  - **Live:** the carried `block-2-0` ended at **y = −244**, below the floor.
- **Likely cause:** Release only happens when the gesture changes on a frame that *has* landmarks. Parking uses a kinematic move that drags anything jointed to it.
- **Recommended fix:**
  1. On landmark loss, **freeze** the hand in place for a 150–250 ms grace period (don't park). If tracking doesn't return, release the joint, restore damping, and clear `heldBlockId`.
  2. When parking, use `setTranslation(…, false)` *after* removing joints, and disable the hand colliders (`collider.setEnabled(false)`) instead of moving them to −100.
  3. Add a kill plane: any block with y < −10 is removed or respawned, and counts as a foul in Classic.
- **Validate:** Turn sim scenario 4 into a regression test: with a 3-frame dropout, no other block moves more than 0.05 units, and the held block falls under gravity only (peak speed below 20 units/s). Add a live E2E: drop landmarks for 3 frames during a carry, then assert the tower is intact.

#### H-6 — Smoothing: per-joint, frame-rate dependent, laggy tail, no outlier rejection, three different filters
**Confirmed issue · P1 · M · 🔎 + ✅ sim/live (partial)**

- **Impact:**
  - Fine positioning feels floaty, and grabs miss because the hand hasn't arrived yet.
  - The cursor, the rendered hand and the gesture logic disagree about where and what the hand is.
  - Glitch frames can still slam the tower.
- **Repro / evidence:**
  - `adaptiveLerp` (`smoothing.ts:24-37`) is keyed on *distance to target* (called "velocity" at `Hand.tsx:146`). The lerp factor `t` ranges 0.08–0.30 **per frame**. That makes it frame-rate dependent (a 120 Hz display converges twice as fast as 60 Hz) and gives it a long ease-out tail: closing the last 0.2 units of error down to 0.05 takes about 10 frames.
  - **Live:** after a staged approach, the smoothed fingertips were still about 0.8 units short of the target when the pinch fired, so the grab missed. It succeeded once I added a 40-frame settle.
  - The **cursor** uses a separate EMA 0.2 (`DepthCursor.tsx:82-84`). **Gestures** use raw landmarks. The **grab point** uses the smoothed thumb and index rigid-body positions (`Hand.tsx:169-174`).
  - Sim 10: one glitch frame of 6 units into the tower displaced blocks by **3.4 units** with the current smoothing, against 0.09 for the raw single-frame glitch. Smoothing *holds* the bad sample inside the tower for several steps instead of rejecting it.
- **Recommended fix:**
  - Use one **One Euro filter** per landmark coordinate in normalized space. Drive it with `dt` from the video frame timestamps, and apply it once, before any consumer.
  - Reject outliers: if the whole-hand centroid jumps more than 0.5 palm lengths in one frame and not on the next, drop that frame.
  - Have all consumers (hand bodies, cursor, gestures, grab target) read the **same** filtered landmarks.
  - Compute the grab target from the filtered pinch point, not from lagging rigid bodies.
- **Validate:**
  - Offline: replay recorded landmark streams (record a few real sessions) and measure jitter RMS at rest (target below 0.05 units) and lag to 90% of a step (target below 80 ms).
  - Live: grab success when pinching within 0.3 s of arriving at a block should exceed 95%.

#### H-7 — Three independent gesture state machines; side effects inside `useMemo`
**Code-confirmed (impact suspected) · P2 · S · 🔎**

- **Impact:** The cursor colour, the hand colour and the actual grab/orbit behaviour can disagree for a frame or more. Each runs its own debounce timers on its own `performance.now()` read (`Hand.tsx:28`, `DepthCursor.tsx:35`, `GestureOrbitController.tsx:15`).
- **Evidence:**
  - `useGesture.ts:44-103` mutates refs inside `useMemo`, which React StrictMode double-invokes in dev.
  - ESLint flags `react-hooks/purity` at `useGesture.ts:45`.
- **Recommended fix:** Compute the gesture once per detection, in the detection loop (or a single store or ref), and have all consumers read that one value.
- **Validate:** A unit test where one landmark stream produces one gesture timeline. Visually, cursor colour changes on the same frame as the grab.

#### H-8 — Inference runs on every animation frame and on the main thread
**Confirmed perf issue · P1 · S–M · 🔎**

- **Impact:**
  - On 60–120 Hz displays with a 30 fps webcam, `detectForVideo` runs 2–4× per camera frame on the same image.
  - Each call blocks the main thread, which also renders and runs physics.
  - Combined with M-1, this is the main source of jank on laptops and phones.
- **Repro / evidence:**
  - `App.tsx:39-49` calls `detect` inside `requestAnimationFrame` with no new-frame check.
  - Capture is requested at 1280×720 (`Webcam.tsx:20-21`), although the landmark model runs on a downscaled input.
- **Recommended fix:**
  - Drive inference with `video.requestVideoFrameCallback` (or skip when `video.currentTime` hasn't changed).
  - Capture at 640×480.
  - Move MediaPipe into a **Web Worker** (`ImageBitmap` transfer or OffscreenCanvas) and post landmarks back.
  - Keep results in a ref (see M-1).
- **Validate:** Count `detectForVideo` calls per second; it should match the camera frame rate. Measure main-thread long tasks (over 50 ms) with the Performance API on a mid-range Android phone.

#### H-9 — MediaPipe WASM version mismatch; GPU-only; no status surfaced
**Confirmed issue · P1 · S · ✅ live (network + console)**

- **Impact:**
  - The JS API is `0.10.22-rc` but the WASM loads from jsdelivr `@0.10.0` (`useHandTracking.ts:12`). The console shows `using deprecated parameters for the initialization function`, a mismatch symptom, and future API drift can break silently.
  - The GPU delegate (`useHandTracking.ts:18`) has no CPU fallback.
  - Failures are only `console.error`'d (`useHandTracking.ts:25-27`). **Live:** with the model blocked, the game looked ready but the hand never appeared.
  - In dev (StrictMode), the 7.6 MB model and the landmarker are created **twice** (two "Graph successfully started running" logs, two downloads), because the async init has no cancellation.
- **Recommended fix:**
  - Self-host the WASM from `node_modules/@mediapipe/tasks-vision/wasm` (copy it to `public/` at build time) so versions always match.
  - Self-host the `.task` model.
  - Try `GPU`, and on failure retry with `CPU`.
  - Expose `trackingStatus: 'loading' | 'ready' | 'error' | 'no-hand'` in the store for the UI (O-1, O-2).
  - Guard the init effect with a cancelled flag and close the instance if it resolves after unmount.
- **Validate:** Offline or air-gapped load works. Blocking the GPU path falls back to CPU with a notice. Blocking the model shows an actionable error.

---

### 2.3 Grabbing & manipulation

#### G-1 — Rigid fixed joint to an infinite-mass kinematic thumb: careful pulls wreck the tower
**Confirmed bug (interaction design) · P0 · M · ✅ live + ✅ sim**

- **Impact:** Jenga is about slow, careful extraction, and the current physics punishes exactly that. The grabbed block follows the hand with unlimited force, so friction from the blocks above and below drags the tower along. There is no "feel", no resistance, and no chance to abort.
- **Repro / evidence:**
  - `Hand.tsx:209-218` creates a `JointData.fixed` between the **kinematic** thumb tip and the block. A kinematic body has effectively infinite mass, so the joint can apply unbounded impulses.
  - Sim 6b pulled a level-8 block out 9 units along its length:

    | friction | block | pull speed (units/s) | max shift of blocks above | blocks above that fell |
    |---|---|---|---|---|
    | 1.0 (current) | centre | **6 (careful)** | **26.6** | **25 (collapse)** |
    | 1.0 | centre | 15 | 0.20 | 0 |
    | 1.0 | centre | 30 (yank) | 0.14 | 0 |
    | 1.0 | edge | 6 | 3.19 | 0 |
    | 0.5 | centre | 6 | 0.33 | 0 |
    | 0.5 | edge | 6 | 0.87 | 0 |

  - **Live:** a slow scripted pull (about 2 units/s) of `block-2-0` succeeded in extracting it (6.2 units), but **45 other blocks moved and the game ended (TOWER COLLAPSED)**.
- **Likely cause:** A rigid joint to a kinematic driver combined with friction 1.0 (G-2).
- **Recommended fix:**
  - Replace the fixed joint with a **force-limited follow**. Either:
    - (a) A dynamic "grab proxy" body driven toward the pinch point with a PD controller (`F = k·Δx − c·v`, clamped to `F_max`) and joined to the block, or
    - (b) A spring joint (`JointData.spring`) or generic-joint motors with a maximum force.
  - Add a **break threshold**: if the block lags the hand by more than about 1.5 units, auto-release, like fingers slipping.
  - Optional **extraction assist**: while the block is still mostly inside the tower, project the hand's motion onto the block's long axis.
- **Validate:**
  - Re-run sim 6b as a regression suite. Requirements: a slow centre pull at 6 units/s shifts the blocks above by less than 0.5 units; yanking at 30 units/s triggers the slip release; extraction still completes for loose blocks.
  - Playtest: share of extractions that collapse the tower when the player is being careful.

#### G-2 — Friction 1.0 on every contact
**Suspected issue → sim-confirmed · P1 · S (tuning) · ✅ sim**

- **Impact:** Pulling one block drags its neighbours (see the G-1 table). Wood on wood is around 0.3–0.5.
- **Evidence:** `Block.tsx:88`, `Table.tsx:5`, `Floor.tsx:5` (all `friction={1}`).
  - Sim 6 (a careful pull with ±0.15 tracking jitter) gave a maximum shift above of 2.57 (μ = 1.0), 1.42 (μ = 0.5) and 0.72 (μ = 0.35).
  - The tower stays standing at rest with lower friction. Re-verify this when C-6 variance is added.
- **Recommended fix:** Start with block↔block μ ≈ 0.45 and block↔table μ ≈ 0.6 (use per-collider friction and `frictionCombineRule`). Tune together with G-1 and P-2.
- **Validate:** Idle-stability sim (30 s, 5 seeds, all blocks asleep, top drift below 0.1) plus the sim 6b thresholds above.

#### G-3 — Hand colliders are 21 tiny infinite-mass balls; any brush moves the tower
**Confirmed issue · P1 · M · ✅ live (qualitative) + ✅ sim**

- **Impact:**
  - Light contact transfers the hand's full motion. **Live:** a sideways approach at constant depth visibly knocked a mid-tower block out of line *before any pinch*. This is from a screenshot and was not counted; a straight front approach displaced 0 blocks.
  - Quick hand moves launch blocks. Sim 8: a 60 units/s fingertip swipe flung a block 12.6 units.
  - Bones have no colliders (`HandBone.tsx`), so blocks pass between joints. The hand collides at 21 points that are each 0.05 units in radius, while the rendered palm is about 6 units across. What you see is not what you hit.
  - Tunnelling was **not** observed even at 120 units/s, because the blocks are thick.
- **Repro / evidence:** `Hand.tsx:51-66` (`kinematicPosition`, `colliders="ball"`, sphere r = 0.05).
- **Recommended fix:**
  - Only the **index fingertip** (pushing) and the **pinch proxy** (grabbing) should collide, using capsules about 0.25 units in radius.
  - All other joints become sensors or have no collider.
  - Clamp the effective pushing velocity (drive a dynamic fingertip with a velocity target and a maximum force), so a tracking glitch can't hit the tower like a hammer.
- **Validate:** A scripted live "brush past the tower" approach displaces 0 blocks by more than 0.3 units. A deliberate poke moves only the poked block.

#### G-4 — "Sticky pinch": pinch in empty air, then sweep into the tower, and it grabs the first block touched
**Code-confirmed (impact suspected) · P2 · S · 🔎**

- **Evidence:** The grab attempt runs on *every frame* while `isPinching && !jointRef.current` (`Hand.tsx:163-164`), not only when the pinch starts.
- **Recommended fix:** Only attempt a grab within about 150 ms of the pinch starting (or on the PINCH_READY→PINCHING edge). Pinching in empty space should show a "missed" cursor state.
- **Validate:** Unit or E2E test: pinch in air, sweep into a block, and assert no joint is created.

#### G-5 — Grab and hover queries return at most one arbitrary collider
**Code-confirmed, latent (mixed evidence) · P2 · S · 🔎 + ✅ sim / ✗ live**

- **Evidence:**
  - `world.intersectionWithShape` "gets the handle of up to one collider" (Rapier `pipeline/world.d.ts:317-325`). The code filters for `isDynamic()` only *after* the query (`Hand.tsx:178-186`, `DepthCursor.tsx:92-100`).
  - When the query returns the hand's own fingertip (kinematic) or the table, no grab happens even if a block is inside the radius.
  - Sim 2: **399 of 571 tight pinches (70%)** failed this way; loose pinches never did.
  - **Live:** 4 of 4 tight pinches succeeded, so the app's internal ordering happened to favour the block. Treat it as a latent fragility.
- **Recommended fix:** Pass a filter, e.g. `QueryFilterFlags.EXCLUDE_KINEMATIC | QueryFilterFlags.EXCLUDE_FIXED`, or `intersectionsWithShape` with a callback. Choose the block **nearest** the pinch point. Put the logic in one shared `findGrabCandidate()` used by both grab and hover (see F-2).
- **Validate:** The sim 2 regression shows 0 failures when a block is in range.

#### G-6 — Held blocks can't be rotated, so they can't be oriented for the top layer
**Code-confirmed · P1 · M · 🔎**

- **Impact:** Layers alternate 90°. A block pulled from an odd level keeps its world yaw, because the joint anchors to the thumb's identity rotation and kinematic joints are only translated (`Hand.tsx:195-218`). If the top layer needs the other orientation, the player has no way to rotate it.
- **Recommended fix:** Combine with the C-3 placement assist: when hovering above the top, ease the held block's yaw to the required layer orientation, or snap on release. Optionally map wrist roll (the angle of landmarks 5→17) to yaw while holding.
- **Validate:** E2E: extract from an odd level, place on top with an even-orientation requirement, and the block lands in the correct slot.

#### G-7 — `collideConnected` is a no-op
**Code-confirmed · P3 · S · 🔎 + ✅ sim**

- **Evidence:** `Hand.tsx:216` sets `(params as any).collideConnected = false`, but Rapier's `JointData` has no such field (`dynamics/impulse_joint.d.ts:173-185`). The real API is `joint.setContactsEnabled(false)` (line 121).
- In sim 6 this made **no measurable difference** (identical results with contacts on and off), so it's low priority.
- **Recommended fix:** Use `setContactsEnabled(false)`, or collision groups that exclude the held block from hand colliders. Drop the `as any`.

#### G-8 — Resetting while holding a block crashes Rapier (black screen)
**Confirmed bug · P0 · S · ✅ live (stack trace)**

- **Impact:** This is easy to hit in real play: the tower collapses *while you're holding the block you pulled*, the GAME_OVER modal appears, you click **RE-INITIALIZE** with the mouse, and your tracked hand is still pinching. The same happens with Sandbox's **RESET TOWER**. When you open your hand, the app dies.
- **Repro / evidence:**
  - Grab a block, then call `resetGame()` (Tower remounts via `key={gameId}`, `App.tsx:68`), then open the hand. The release branch calls `grabbedBodyRef.current.setLinearDamping(...)` on a removed body (`Hand.tsx:231-235`).
  - Captured page error: `RuntimeError: unreachable … at rbSetLinearDamping … at Hand.tsx`.
  - That was followed by a flood of `recursive use of an object detected which would lead to unsafe aliasing in rust`, then `An error occurred in the <CanvasImpl> component`. The R3F root unmounted.
- **Likely cause:** Joint and body refs outlive the Tower's bodies. There is no error boundary.
- **Recommended fix:**
  - Store held state (joint handle, body handle) in one place and clear it when `gameId` changes (subscribe in `Hand`), on Tower unmount, and on tracking loss.
  - Before touching a body, check `world.getRigidBody(handle)` and `world.getImpulseJoint(handle)`.
  - Wrap `<Canvas>` children in an error boundary that offers "Restart" and remounts the Physics world.
- **Validate:** E2E: grab, reset, open hand. Assert no page errors and that the canvas is still present. Repeat 20 times.

---

### 2.4 Physics stability

#### P-1 — Resting tower stability is good *(positive finding)*
**✅ sim**

- Across 5 seeds, with 30 s of idle simulation each:
  - All **54/54 blocks fall asleep**.
  - Top-block settling is 0.081–0.083 units, and maximum tilt is 0.046°.
  - Cost is 0.19–0.22 ms per step (Node, ARM64).
- Physics is **not** the performance bottleneck. Keep the current solver settings when tuning friction and gravity, and re-run this check after every physics change.

#### P-2 — The world is about 100× real scale under real gravity, so collapses play in slow motion
**UX improvement · P2 · S–M · ✅ sim**

- **Impact:** Blocks are 7.5 units long (a real block is 7.5 cm), and gravity is 9.81 (`App.tsx:60`), so the tower behaves like a 27 m structure. In sim 9, a topple took **5.3 s** for the top to reach the table. With gravity ×2.5 it took **3.3 s**. A real tower falls in under a second. That feels floaty, and it is part of why game over feels late (C-4).
- **Recommended fix:** Try gravity ×2–3 together with friction 0.45 and the soft grab (G-1). Then re-run the idle stability and pull suites. Don't scale geometry down without re-tuning Rapier tolerances.
- **Validate:** The sim suite passes, and playtesters rate the falls as believable.

#### P-3 — `mass={2}` is silently ignored
**Code-confirmed · P3 · S · 🔎**

- **Evidence:** `@react-three/rapier` excludes `mass` when merging `RigidBody` props into child colliders (`react-three-rapier.cjs.dev.js:229`). With `colliders={false}` and an explicit `CuboidCollider` (`Block.tsx:93-95`), each block uses density 1, about 28.1 kg instead of 2. This is harmless while all blocks are equal, but it misleads anyone tuning damping and forces.
- **Fix:** Put `mass={2}` (or `density`) on the `CuboidCollider`.

#### P-4 — Hand bodies update on render frames, not physics steps
**Code-confirmed (impact suspected) · P2 · S · 🔎**

- **Impact:**
  - Physics steps at a fixed 1/60 s with an accumulator (`@react-three/rapier`), while the hand calls `setNextKinematicTranslation` in `useFrame`.
  - At 30 FPS there are 2 steps per frame. The kinematic body moves in the first step and is still in the second, so pushes stutter.
  - At 120 Hz, half the frames have no step.
  - After a hitch, the 0.5 s delta clamp allows up to 30 catch-up steps with a stale hand target.
- **Fix:** Set kinematic targets in `useBeforePhysicsStep`, interpolating between the last two filtered samples by step time.
- **Validate:** Sim plus live: identical push outcomes at 30, 60 and 120 FPS (use the scripted landmark harness with throttled rAF).

#### P-5 — No out-of-bounds handling
**Confirmed issue · P2 · S · ✅ live**

- **Evidence:** A tunnelled block (H-5) kept falling (live y = −244) and kept simulating. In Sandbox that block is simply lost. Fix with a kill plane (H-5 step 3).

---

### 2.5 Camera & view

#### V-1 — Default framing cuts off the top third of the tower
**Confirmed · P0 (part of C-3) · S · ✅ screenshots**

See C-3. Retarget the camera and adjust FOV and distance so the whole tower plus 2 levels of headroom is visible on 16:9 and 9:16.

#### V-2 — OrbitControls are unconstrained, and zoom breaks reach
**Code-confirmed · P1 · S · 🔎 + ✅ geometry**

- **Impact:**
  - The camera can orbit under the table or floor: there is no `maxPolarAngle`, at `App.tsx:72`, nor in the gesture orbit at `GestureOrbitController.tsx:39-40`.
  - The mouse wheel can zoom to any distance, and because hand reach is fixed at 12–28 units from the camera (C-3), zooming out puts *every* block out of reach. In the geometry check, the "zoomed out" setups had 0 reachable blocks.
  - There is no "reset view".
- **Fix:** `minDistance`/`maxDistance` (for example 25–45), `maxPolarAngle ≈ 80°`, `minPolarAngle ≈ 15°`, `enablePan={false}`, and a "Reset view" button or gesture. Implement the target-relative interaction volume (C-3).

---

### 2.6 Visual feedback

#### F-1 — Block hover highlight can never trigger
**Confirmed bug · P1 · S · 🔎 library source + ✅ live**

- **Impact:** Players get no indication of which block a pinch would grab. This is the single most important affordance in a depth-ambiguous input scheme.
- **Repro / evidence:**
  - `DepthCursor.tsx:102-103` reads `rigidBody.userData?.name`.
  - `@react-three/rapier` sets the Rapier body's `userData` **only** from a `userData` prop (`react-three-rapier.cjs.dev.js:1252-1254`). `Block` passes `name=` instead (`Block.tsx:90`), which goes onto the three.js `object3D`.
  - So `blockName` is always `''`, and `hoveredBlockId` stays `null`. **Live:** `hoveredBlockId` was `null` throughout hovering, pinching and carrying next to a block.
- **Fix:** Add `userData={{ id, name: \`block-${id}\` }}` to the `RigidBody`, or keep a `Map<colliderHandle, blockId>`. Combine with the filtered query (G-5) and a per-block selector (M-1).
- **Validate:** E2E: hover within 0.3 units of a face and `hoveredBlockId === 'block-2-0'`. Visually, a cyan tint plus a scale pulse.

#### F-2 — Cursor "in range" and proximity feedback effectively never show
**Confirmed bug · P1 · S · ✅ sim**

- **Evidence:** `DepthCursor.tsx:119-127` computes `dist` to the block's **centre** and shows "in range" if `dist < 0.5`. But blocks are 2.5 × 1.5 × 7.5, and the grab succeeds whenever the 0.5 ball touches the block's **surface** (`Hand.tsx:176-182`).
  - Sim 3: across **807** cursor positions outside blocks where a pinch *would* grab, the cursor showed "in range" **0** times, and proximity was above 0 only once.
  - The cyan ring, secondary ring, proximity pulse and wireframe grab sphere (`DepthCursor.tsx:176-232`) are effectively dead UI.
- **Fix:** Compute one grab candidate per frame (G-5) using surface distance (`world.projectPoint` or a contact query), and drive both the feedback and the actual grab from it.
- **Validate:** Feedback says "in range" ⇔ a pinch would grab. Assert this equivalence over 1,000 random points in sim.

#### F-3 — No shadows or depth cues
**Confirmed · P1 · S · 🔎 + ✅ screenshots**

- **Impact:** Depth is the hardest axis with a webcam, and there is nothing to judge it by. The screenshots show a flat, washed-out tower with the thin hand floating at an unknown depth.
- **Evidence:**
  - `<Instances>` lacks `castShadow` and `receiveShadow` (`Tower.tsx:51`), the table mesh lacks `receiveShadow` (`Table.tsx:6`), and hand meshes don't cast.
  - The shadow camera is ±10 units at `[5,10,5]` (`Lighting.tsx:9-14`), while the tower is 27 units tall, so its top would be outside the shadow frustum anyway.
  - `<Canvas shadows>` therefore renders a shadow pass that nothing uses.
- **Fix:**
  - Cast and receive shadows on blocks and table, and fit the shadow camera to the tower bounds (for example ±12 horizontally, light at about `[15,40,15]`).
  - Add a **contact shadow or projected dot** from the pinch point onto the nearest surface, plus a short ray.
  - Optionally fade blocks between the camera and the cursor.
- **Validate:** Playtest depth errors (how far a pinch lands from the intended face) before and after. Check frame time on mobile.

#### F-4 — The virtual hand is huge, thin and hard to read
**UX improvement · P2 · S–M · ✅ screenshots**

- **Evidence:** Bones are 0.04 units in radius and joints 0.05 (`HandBone.tsx:53`, `Hand.tsx:59`), but the palm spans about 6 world units at playing depth (palm size 0.245 × 25), roughly a whole block length. Screenshots show a faint wireframe sprawling over half the screen. States are colour-only (grey/cyan/orange).
- **Fix:** Render a thicker, semi-transparent stylised hand (or just fingertips plus the pinch point) scaled down to block proportions. Emphasise the index tip and thumb tip, and show state with shape as well as colour (A-2).

#### F-5 — Debug grid and low block contrast
**UX improvement · P3 · S · ✅ screenshots**

- **Evidence:** `gridHelper` (`App.tsx:74`) sits at y = 0, the same plane as the table top, so it z-fights across the table. Blocks are nearly white with low contrast between neighbours.
- **Fix:** Remove the grid. Add wood textures or a stronger per-block hue and roughness variation, and darker edge lines between blocks.

#### F-6 — No audio or haptic feedback
**Feature opportunity · P2 · M**

Add wood clacks on contact (scaled by impulse, using contact-force events), a scrape loop while sliding, a soft click on grab and release, a tower creak when the maximum velocity rises, and a collapse rumble. Audio is a powerful substitute for missing touch feedback.

#### F-7 — `DepthCursor` reads refs during render
**Code-confirmed · P3 · S · 🔎**

- **Evidence:** Colour, rings and opacity read `isInRangeRef.current` and `proximityRef.current` in render (`DepthCursor.tsx:157-172, 188, 222`; lint `react-hooks/refs`). They only update because of the per-frame root re-render (M-1).
- **⚠ Coupling:** when M-1 removes per-frame `setState`, the cursor and hand colours will **freeze** unless they move to imperative material updates in `useFrame`. Do both together.

---

### 2.7 Onboarding, recovery & error handling

#### O-1 — No onboarding, calibration or tracking status
**UX improvement · P1 · M · ✅ live + 🔎**

- **Impact:** New players face several unexplained mechanics at once: depth through hand size (H-3), pinch, the hidden open-palm orbit, and camera-relative mapping. They get a 5-second overlay that says "PINCH TO GRAB / STEADY HAND TO MOVE" (`HUD.tsx:18-25, 42-47`).
- **Gaps:**
  - The camera preview is hidden by default (`gameStore.ts:33`).
  - Nothing indicates "hand detected / not detected / model loading".
  - The "calibrate" promise (`StartScreen.tsx:35`) isn't kept.
  - "AR" is promised, but the camera feed isn't composited, so players don't see themselves.
- **Fix:** A 60–90 s guided first-run:
  1. Camera check, with the preview and landmark overlay on by default.
  2. Calibration for near and far (H-4).
  3. "Touch the glowing block" (depth practice).
  4. "Pinch to grab, open to release".
  5. "Pull the loose block out".
  6. "Place it on top" (with the C-3 assist).

  Also add a persistent small status chip (Loading model… / Show your hand / Tracking ✓ / Low light) and a "?" button to replay hints.
- **Validate:** First-time playtesters complete the first extraction and placement within 2 minutes, unaided, at a rate above 80%.

#### O-2 — About 13 MB of startup downloads with no loading or error UI
**Confirmed · P1 · S–M · ✅ live (network)**

- **Evidence (first in-game load):**

  | Asset | Size |
  |---|---|
  | JS bundle | 3.56 MB (1.21 MB gzip) |
  | MediaPipe WASM (jsdelivr) | 2.5 MB |
  | `hand_landmarker.task` (googleapis) | 7.6 MB, downloaded **twice** in dev |
  | Studio HDR (raw.githack → raw.githubusercontent) | 1.6 MB |

  None of this is surfaced. On a slow connection, the player sees a 3D room and no hand for many seconds.
- **Fix:**
  - Preload the model and HDR while the start screen is shown (it already preloads, but silently).
  - Show progress and the current step.
  - Self-host the assets, cache them with a Service Worker, and code-split the 3D/physics bundle away from the start screen (M-3).

#### O-3 — The HDR environment comes from a third-party CDN; if it fails, the whole app unmounts
**Confirmed bug · P1 · S · ✅ live**

- **Repro:** Block `raw.githack.com`/`githubusercontent.com` and start Classic. The console shows `Could not load studio_small_03_1k.hdr: Failed to fetch`, and **both the canvas and the HUD disappear**: a blank screen with no way back. This affects offline use, corporate firewalls and some regions.
- **Cause:** `<Environment preset="studio">` (`EnvironmentSetup.tsx:6`) fetches at runtime. There is no `<Suspense>` fallback and no error boundary (`App.tsx:59-76`).
- **Fix:** Ship the HDR in `public/` (`<Environment files="/hdri/studio_1k.hdr" />`), or replace it with a lightweight procedural `Lightformer` setup. Add a Suspense fallback and an error boundary with "Retry".

#### O-4 — Every camera error says "enable camera access"
**Confirmed · P2 · S · ✅ live**

- **Evidence:** `Webcam.tsx:35-38` maps every error to "Camera access required". **Live:** `NotFoundError: Requested device not found` showed "Please enable camera access to play".
  - Other cases with the same message: `NotReadableError` (camera in use by another app), `OverconstrainedError`, and a non-secure context (opening via a LAN IP over http, where `navigator.mediaDevices` is undefined).
- **Fix:** Map `err.name` to specific guidance and actions: allow in browser settings / plug in a camera / close the other app / use https or localhost. Offer a device picker (`enumerateDevices`) and a pointer-mode fallback (A-1).

#### O-5 — The webcam stays on after exiting during camera start-up
**Confirmed bug (privacy) · P1 · S · ✅ live**

- **Repro / evidence:**
  - Start a mode, then press EXIT GAME before `getUserMedia` resolves. This happens naturally while the permission prompt is open or a slow camera is starting. Live, with a 1.5 s artificial delay: **2 streams opened, 2 tracks still live after exit**, so the camera LED stays on.
  - In dev, StrictMode's double mount also leaves **1** live track after a normal exit.
- **Cause:** `Webcam.tsx:41-55`: the cleanup stops `streamRef.current`, which is still `null` while the request is pending. The stream is assigned later (line 26) and never stopped.
- **Fix:** Use a `cancelled` flag in the effect. If the stream resolves after cleanup, stop its tracks immediately. Also clear `videoElement` and `result` in `App` when leaving a mode (O-7).
- **Validate:** The Playwright check in §4 shows live tracks = 0 after exit, both with and without the delay.

#### O-6 — One-click exits and a HUD bar that blocks the scene
**UX improvement · P2 · S · 🔎**

- **Evidence:** Clicking the title (`HUD.tsx:32`) or EXIT GAME returns to the menu instantly, with no confirmation, and the game is lost. The top bar is `pointer-events: auto` across the full width (`HUD.css:20`), so mouse orbit drags starting there are swallowed.
- **Fix:** Confirm exits in Classic when a game is in progress. Make only the actual controls clickable.

#### O-7 — Stale tracking state across mode switches
**Code-confirmed · P3 · S · 🔎**

- **Evidence:** `App.tsx:25-27`: `result`, `videoElement` and `cameraActive` persist after returning to the menu. The next game briefly renders the hand at its last position and runs detection on the old (stopped) video element until the new one is ready.
- **Fix:** Reset them on mode change.

#### O-8 — Menus and modals need a mouse
**Feature opportunity · P2 · M**

- **Evidence:** RE-INITIALIZE, MAIN MENU, SHOW CAMERA and EXIT are mouse or keyboard only. A player standing back with one hand up must walk to the mouse after every collapse.
- **Fix:** Gesture-operable UI: point with the index finger plus dwell for 0.8 s, or pinch over a button.

#### O-9 — No pause; play continues after game over
**UX improvement · P3 · S**

- **Evidence:** Physics and hand colliders stay active behind the GAME_OVER modal.
- **Fix:** Add a pause state (key, button or gesture) that pauses `<Physics paused>` and ignores the hand. Pause automatically on `visibilitychange`.

---

### 2.8 Performance & mobile

#### M-1 — Every detection frame re-renders the whole scene graph, including all 54 blocks
**Confirmed perf issue · P1 · M · ✅ live (React commit instrumentation)**

- **Evidence:**
  - `App.tsx:43` calls `setResult(res)` on every animation frame. `detect` returns a new object even when no hand is present.
  - React then re-renders `App` → `Canvas` children → `Tower` → all 54 `Block` components (none are memoized), plus 21 hand rigid bodies and 23 bones.
  - **Live**, measured with a DevTools-hook commit counter: **54 Block renders per commit, with no hand in view**, and one commit per root per frame (about 25 commits/s across the two React roots at 12 FPS). At 60 FPS that is about 3,200 Block renders per second doing nothing.
  - Additionally, every Block subscribes to `hoveredBlockId` and `heldBlockId` (`Block.tsx:20-21`), so a hover change re-renders all 54.
- **Fix:**
  - Keep landmarks, gestures and the grab candidate in refs or a transient zustand slice, read inside `useFrame`.
  - Only emit React state on *discrete* changes (tracking status, held/hovered id).
  - Wrap `Block` in `memo` and use per-block selectors (`useGameStore(s => s.hoveredBlockId === myId)`).
  - Move hand and cursor colours to imperative updates (see F-7).
- **Validate:** The commit counter (§4) shows 0 commits per second at rest with a hand present, and Block renders appear only on that block's hover or held change. Compare frame-time p95 on a mid-range phone before and after.

#### M-2 — Per-frame allocations
**Code-confirmed · P3 · S · 🔎**

- **Evidence:**
  - `HandBone.tsx:27-45` allocates 3–4 `Vector3` per bone per frame (×23).
  - `Hand.tsx:134` allocates a `Vector3` per landmark per frame.
  - `DepthCursor.tsx:74,91` and `Hand.tsx:176` allocate a new `rapier.Ball` per query.
  - Together, about 100 allocations per frame cause GC churn on mobile.
- **Fix:** Hoist scratch vectors and shapes to module scope.

#### M-3 — A single 3.56 MB JS chunk
**Confirmed · P2 · S–M · ✅ build**

- **Evidence:** `npm run build` emits one chunk, `index-*.js`, at 3,562 KB (1,212 KB gzip), with Vite's ">500 kB" warning. It includes Rapier's inlined WASM.
- **Fix:** Lazy-load the game scene (`React.lazy` around the Canvas tree) so the start screen paints instantly, and prefetch while the start screen is shown. Consider `@dimforge/rapier3d` (non-compat, a separate `.wasm` file that streams and compiles) if the build setup allows.

#### M-4 — Portrait phones: hand mapping ignores the camera aspect ratio
**Confirmed bug · P1 (mobile) · S–M · ✅ live screenshot + 🔎**

- **Impact:**
  - `VIEW_WIDTH = 45` is hard-coded (`Hand.tsx:111`, duplicated in `DepthCursor.tsx:64`).
  - In 9:16 portrait at FOV 75°, the visible width at a depth of 20 is only about 14 units, so horizontal sensitivity is about 3× too high. Most of the hand's range is off-screen.
  - **Live** at 390×844: with the real hand only slightly off-centre (wrist at x = 0.38), the virtual hand was almost entirely off the right edge.
- **Fix:** Unproject normalized landmark coordinates through the actual camera frustum at the interaction depth (`new Vector3(ndcX, ndcY, z).unproject(camera)`, or derive width and height from `fov` and `aspect`). Put this in one shared `landmarkToWorld()` used by Hand and DepthCursor.
- **Validate:** On 16:9, 4:3 and 9:16, moving the real hand from frame edge to frame edge spans the screen edge to edge.

#### M-5 — Responsive layout issues
**Confirmed · P2 · S · ✅ live**

- **Evidence:**
  - Start screen at 390 px: `.start-content` spans **−141 to 531 px**, so both mode buttons and the title are clipped (`StartScreen.css:32-39, 54-67`: 4rem title with 12px letter-spacing, `min-width: 280px` buttons side by side, no media queries).
  - In game on a phone, the HUD bottom buttons (x 20–279, y 787–824) overlap the camera preview (x 126–370, y 685–824).
- **Fix:** Stack the mode buttons below about 700 px, use `clamp()` font sizes, and move the preview above the controls (or make it collapsible), respecting `env(safe-area-inset-*)`.

#### M-6 — Physics is not the bottleneck *(info)*
**✅ sim**

At 0.19–0.22 ms per step for 54 dynamic plus 21 kinematic bodies, focus performance work on inference (H-8) and React (M-1). Shadows (F-3) add GPU cost, so budget for them with a quality toggle.

---

### 2.9 Accessibility

#### A-1 — Hand tracking is the only gameplay input
**Feature opportunity / accessibility · P1 · M–L · 🔎**

- **Impact:** This excludes players without a webcam, with limited arm mobility or tremor, in poor lighting, or on devices where MediaPipe is slow. It also makes QA and automated testing much harder.
- **Fix:** Add a **pointer/touch mode**:
  - Raycast to pick a block.
  - Drag constrained to the block's long axis while it's in the tower, then free drag on a plane.
  - Wheel, pinch-zoom or two-finger drag for height.
  - Tap to place with the C-3 snap.

  Reuse the same soft-grab physics (G-1) so the feel matches.

#### A-2 — State shown by colour only
**UX improvement · P2 · S · 🔎**

- **Evidence:** Grey/cyan/green/orange cursor and hand states (`DepthCursor.tsx:19-24`, `Hand.tsx:35-45`). Cyan versus green and green versus orange are hard to tell apart with deuteranopia.
- **Fix:** Add shape and icon changes (open ring → filled dot → closed brackets), plus an optional high-contrast palette.

#### A-3 — Low-contrast small text; motion without reduced-motion support
**UX improvement · P3 · S · 🔎**

- **Evidence:**
  - The start footer is 0.8rem at `opacity: .5` (`StartScreen.css:99-103`), about 3.4:1 contrast against `#111`, below WCAG AA's 4.5:1.
  - `.btn-desc` is 0.7rem.
  - The start panel flickers forever (`StartScreen.css:105-116`) without honouring `prefers-reduced-motion`.
- **Positive:** Menu and HUD buttons are real `<button>`s, reachable by Tab, with visible focus outlines (verified).

#### A-4 — Arm fatigue
**UX improvement · P2 · M · ❓**

- **Impact:** Absolute, arm-extended mapping causes "gorilla arm" within minutes (needs a playtest).
- **Fix:** Offer a **clutch / relative mode**: pinch-and-hold in empty space to drag the interaction volume, or rest the hand to pause. Add pause (O-9) and session-length nudges.

---

### 2.10 Code health & tests

#### Q-1 — 6 of 74 tests fail and lint reports 49 errors
**Confirmed · P2 · S–M · ✅ toolchain**

- **Evidence:**
  - `npx vitest run`: 3 files and 6 tests fail.
    - `useGesture.test.ts` still expects removed `FIST*` states.
    - `Block.test.tsx` and `DepthCursor.test.tsx` lack mocks for `useFrame`/`useRapier` added in later commits.
  - `npm run lint`: 49 errors.
    - Mostly `no-explicit-any` in tests.
    - In runtime code: `react-hooks/purity` (`Math.random` in render at `Tower.tsx:28-30` and `Block.tsx:36`; `performance.now` in `useGesture.ts:45`).
    - `react-hooks/refs` (`DepthCursor.tsx`, 7×).
    - `no-explicit-any` (`Hand.tsx:88,216`, `DepthCursor.tsx:102`).
  - The build passes.
- **Fix:** Update the stale tests. Seed tower randomness via `useState(() => generate(seed))`. Fix the runtime lint errors as part of H-7 and F-7. Enforce `lint` and `test` in CI.

#### Q-2 — Tests don't cover what actually breaks
**Confirmed · P2 · M · 🔎**

- **Evidence:** Heavy mocking of R3F and Rapier means none of C-1…C-4, G-1, G-8 or H-5 can be caught.
- **Fix:** Add two thin harnesses (both prototyped for this review; see §4):
  - A **headless Rapier suite** (Node, real `rapier3d-compat`) for physics and rules.
  - **Playwright E2E with a scripted MediaPipe stand-in** for interaction flows.

#### Q-3 — Housekeeping
**P3 · S · 🔎 / ✅**

- Mapping constants are duplicated (`Hand.tsx:111-113`, `DepthCursor.tsx:64-66`).
- `utils/coordinates.ts` and `utils/math.ts` are dead code (only referenced by tests) and have *different* constants.
- `isClosedFist` means open palm.
- The README describes old controls (and the opposite depth direction, see H-3).
- `index.html:7` title is "temp-project".
- `/vite.svg` favicon (`index.html:5`) doesn't exist: there is no `public/` dir, and the dev server returns `index.html` with `text/html`.
- Branding is inconsistent ("Robotic Jenga" in-game, "AR Jenga" in docs).

---

### 2.11 Missing features that would meaningfully improve play (ranked)

| # | Feature | Why it matters | Effort |
|---|---|---|---|
| 1 | Placement assist (ghost slot, auto-yaw, snap) | Makes the second half of every turn possible (C-3, G-6) | M |
| 2 | Guided first-run tutorial and calibration | Removes the steepest learning cliff (O-1, H-4) | M |
| 3 | Classic rules, stable-turn timer, scoring | Turns the toy into a game (C-1, C-5) | M |
| 4 | Pass-and-play multiplayer | How Jenga is really played; big replay value | M |
| 5 | Audio (contacts, scrape, creak) | Replaces missing touch feedback | M |
| 6 | Pointer/touch mode | Accessibility, mobile, QA (A-1) | M–L |
| 7 | Block tolerance variance and difficulty presets | Restores "find the loose block" (C-6) | S–M |
| 8 | Stability meter or wobble warning | Readable tension; teaches cause and effect | M |
| 9 | Slow-motion collapse replay and share | Delight and virality | L |
| 10 | "Mirror AR" (webcam as background) or a WebXR AR mode | Delivers on the "AR" name; WebXR enables real tabletop placement on phones and headsets | M (mirror) / XL (WebXR) |

---

## 3. Prioritized roadmap

Order of work: **reliability → a completable core loop → interaction feel → feedback and onboarding → performance and mobile → features.** Items inside each phase are listed in suggested order. Dependencies are noted.

### Phase 1 — Quick wins (about 1 week; mostly S)

| # | Item | Findings | Effort | Acceptance check |
|---|---|---|---|---|
| 1 | Release the joint on tracking loss (grace freeze); disable instead of park; kill plane | H-5, P-5 | S | Sim 4 regression: no collateral; live 3-frame dropout leaves the tower intact |
| 2 | Clear held state on `gameId` change; validate handles; error boundary around Canvas | G-8 | S | 20× grab→reset→release with 0 page errors |
| 3 | Set and clear `heldBlockId`; fix the held highlight; rework "safe" | C-2 | S | Store shows the held id during a carry |
| 4 | Shared `findGrabCandidate()` (filtered query, nearest block, surface distance); `userData` on blocks | F-1, F-2, G-5 | S | Hover ⇔ grabbable equivalence test; hover highlight visible |
| 5 | Grab only on pinch onset | G-4 | S | Sticky-pinch test |
| 6 | Webcam start-up race (`cancelled` flag); reset stale state | O-5, O-7 | S | 0 live tracks after exit |
| 7 | Self-host HDR, model and matching WASM; GPU→CPU fallback; tracking-status chip | O-3, H-9, O-2 (part) | S | Works offline; blocked model shows an error |
| 8 | Scale-normalize gesture thresholds (palm-relative) | H-1 | S–M | Classifier invariant over s ∈ [0.06, 0.40] |
| 9 | Orbit limits, no pan, Reset view; remove `gridHelper`; enable and fit shadows | V-2, F-5, F-3 | S | Camera can't go below the table; shadows visible |
| 10 | Friction 0.45 / 0.6 (behind a constant), then re-run the sim suite | G-2 | S | Idle stability passes; slow centre pull shift < 1 |
| 11 | Fix 6 failing tests and runtime lint errors; README, HUD copy, title, favicon | Q-1, Q-3, H-3 (docs) | S | CI green |

### Phase 2 — Medium-term: make the loop complete and feel right (about 3–4 weeks)

| # | Item | Findings | Effort | Notes / dependency |
|---|---|---|---|---|
| 1 | Camera framing on the tower plus a **target-relative interaction volume** | C-3, V-1 | M | Prerequisite for placement |
| 2 | Placement assist: ghost slot, auto-yaw, snap; optional placement view | C-3, G-6 | M | After #1 |
| 3 | Move state machine + scoring + rule-based foul detection (no floor dependency) | C-1, C-4 | M | Uses held id (Phase 1 #3) |
| 4 | **Soft grab**: PD/spring with force cap and slip release; optional axis assist | G-1 | M | Re-tune with friction; sim 6b thresholds |
| 5 | Finger colliders: index tip and pinch proxy only, capsule, velocity-capped | G-3 | M | With #4 |
| 6 | One Euro filtering, outlier rejection, single shared landmark and gesture source | H-6, H-7 | M | Pairs with M-1 |
| 7 | Render architecture: refs or transient store, memoized blocks, imperative cursor and hand visuals | M-1, F-7 | M | **Must** land with the F-7 changes |
| 8 | Inference on `requestVideoFrameCallback` at 640×480 (worker in Phase 3) | H-8 | S–M | |
| 9 | Kinematic targets in `useBeforePhysicsStep` | P-4 | S | |
| 10 | Deliberate, clutched camera mode (or two-hand orbit); lower sensitivity | H-2 | M | After H-1 |
| 11 | Depth: A/B "mirror" vs "reach-in", depth gauge, 5-second calibration | H-3, H-4 | M | Needs playtests |
| 12 | Frustum-based landmark→world mapping; responsive start screen and HUD | M-4, M-5 | S–M | Enables mobile |
| 13 | Guided first-run tutorial; specific camera errors; exit confirmation | O-1, O-4, O-6 | M | After #1–#4 so the tutorial teaches the final mechanics |
| 14 | Headless Rapier regression suite + Playwright scripted-hand E2E in CI | Q-2 | M | Locks in all of the above |
| 15 | Gravity ×2–3 tuning; block tolerance variance | P-2, C-6 | S–M | Re-run idle stability and pull suites |

### Phase 3 — Larger enhancements (1–2 months)

| # | Item | Findings | Effort |
|---|---|---|---|
| 1 | Pointer/touch play mode (full parity) | A-1 | M–L |
| 2 | Gesture-operable menus and modals; pause and auto-pause | O-8, O-9 | M |
| 3 | Classic rules, turns, pass-and-play multiplayer, best scores | C-5 | M–L |
| 4 | Audio system (contact-force driven) and a stability meter | F-6 | M |
| 5 | MediaPipe in a Web Worker; adaptive quality (shadow/DPR toggles); code-split bundle; Service Worker cache | H-8, M-3, O-2 | L |
| 6 | Stylised hand rendering; colour-blind-safe state shapes; reduced motion | F-4, A-2, A-3 | M |
| 7 | Clutch/relative mode for fatigue | A-4 | M |
| 8 | "Mirror AR" background, then an optional WebXR AR mode with hit-test table placement | feature #10 | M → XL |
| 9 | Collapse replay and share | feature #9 | L |

### How to measure success across phases

Instrument these (dev overlay plus optional anonymous telemetry), and track them in a fixed 5–8 person playtest protocol: first-time users, a mid-range Android phone plus a laptop webcam, good and poor lighting.

| Metric | Today (where known) | Target |
|---|---|---|
| Completed moves (extract + place + stable) per new player in 5 min | 0 (scoring absent; top unreachable) | ≥ 3 |
| Grab success when pinching within 0.3 s of reaching a block | Low (lag-dependent; misses observed live) | ≥ 95% |
| Unintended camera orbits per minute | > 0 (2 accidental-orbit runs) | 0 |
| Tower collapses caused by tracking dropouts or glitches | Certain on dropout while holding | 0 |
| Delay from collapse to game-over feedback | ≈ 2.0 s | ≤ 0.5 s |
| React commits per second at rest with a hand present | ≈ 1 per root per frame | ~0 (discrete events only) |
| `detectForVideo` calls per second ÷ camera fps | 2–4× on high-refresh displays (by design) | 1.0 |
| Time to interactive on 4G (first visit) | ≈ 13 MB of blocking-ish downloads, no indicator | Start screen < 2 s; progress shown |
| Page errors during a 10-minute soak (including resets) | Rapier panic reproducible | 0 |

---

## 4. Appendix — reproduction harness used for this review

These were written for the review in a scratch directory and are **not** in the repo. They're described here so the team can turn them into regression tests (Q-2).

**A. Headless physics replica (Node).**

- Load `@dimforge/rapier3d-compat` from `node_modules` and set the world parameters to `@react-three/rapier` 2.2 defaults: `timestep 1/60`, `numSolverIterations 4`, `numInternalPgsIterations 1`, `allowedLinearError 0.001`, `predictionDistance 0.002`, `contact_natural_frequency 30`, `lengthUnit 1`.
- Recreate:
  - Floor cuboid (50, 0.5, 50) at y = −5.
  - Table cuboid (5, 1, 5) at y = −1.
  - 54 blocks of (1.25, 0.75, 3.75) with friction 1 and density 1. Note that `mass` is ignored, as explained in P-3.
  - 21 kinematic balls of r = 0.05 for the hand.
- Replicate grab exactly: Ball(0.5) `intersectionWithShape` → `isDynamic()` → `JointData.fixed` from thumb to block, with damping 2.
- Scenarios: idle stability; grab-query self-hit; cursor "in range" against grabbable; tracking loss while holding; teleport impulse (ruled out: 0.27 vs 0.13 units/s); pull speed × friction × centre/edge; collapse latency; fingertip swipe speed (no tunnelling up to 120 units/s); topple time against gravity; single-frame glitch with and without smoothing.

**B. Scripted-hand E2E (Playwright + Vite dev server).**

```js
// Replace MediaPipe with a stand-in whose output is controlled from the test.
await context.route(/@mediapipe_tasks-vision\.js/, r => r.fulfill({
  contentType: 'application/javascript',
  body: `export const FilesetResolver = { forVisionTasks: async () => ({}) };
         export const HandLandmarker = { createFromOptions: async () => ({
           detectForVideo: () => ({ landmarks: window.__hand ? [window.__hand] : [],
                                     worldLandmarks: [], handedness: [], handednesses: [] }),
           close() {} }) };` }));
// Chromium flags: --use-fake-ui-for-media-stream --use-fake-device-for-media-stream
await page.evaluate(h => { window.__hand = h; }, landmarks21);           // drive the hand
const s = await page.evaluate(() => import('/src/store/gameStore.ts')
  .then(m => m.useGameStore.getState()));                                 // read live game state
// Block positions: import the same '@react-three_fiber.js?v=…' URL the app loaded, then
// [..._roots.values()][0].store.getState().scene.traverse(o => o.name.startsWith('block-'))
```

- Poses are built in palm-length units and positioned with the inverse of `Hand.tsx`'s mapping. Given a world target `W`, use the camera inverse quaternion to get local `(lx, ly, lz)`, then `x = 0.5 − lx/45`, `y = 0.5 − ly/25`, `handZ = 20 + lz`, and `palm = 0.02 + 0.33·(handZ+8)/16`.
- Extra instrumentation:
  - A stub `__REACT_DEVTOOLS_GLOBAL_HOOK__` counts commits and `Block` fibres with `PerformedWork`.
  - A `getUserMedia` wrapper (optionally delayed) counts live tracks after exit.
  - `route.abort()` simulates CDN failures.

**C. Commands run.**

```bash
npm ci
```

```bash
npx vitest run
```

```bash
npm run lint
```

```bash
npm run build
```

Results: 68/74 tests pass and 6 fail; 49 lint errors; the build succeeds with one 3.56 MB chunk. `node_modules/` and `dist/` were created locally; both are git-ignored.
