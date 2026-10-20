# Manual playtest checklist

The success metrics from GAME_REVIEW.md §3 ("How to measure success across phases"), as a checklist for a real-hand
playtest. Everything on branch `review-fixes` so far was checked with scripted landmarks (Playwright) and a headless
physics harness, never with real hands. This playtest is what decides whether the hand-tracking changes actually
feel better.

**There's no in-game metrics overlay or telemetry.** The review suggested instrumenting these; no phase built it.
So each row says how to measure it by hand: a stopwatch, a screen recording or DevTools. The "automated proxy" column
says what the test suites already show, which is the floor, not the answer.

## Protocol

- [ ] **5–8 first-time players.** They have never seen the game, and don't get it explained. The tutorial runs on
      their first Classic game, so use a fresh browser profile each, or clear site data (`ar-jenga-settings` in local
      storage).
- [ ] **Two devices:** a laptop with its built-in webcam (Chrome), and a mid-range Android phone (Chrome), both in
      portrait and in landscape.
- [ ] **Two lighting set-ups:** a well-lit room, and a dim one (one lamp behind the player).
- [ ] **Screen-record every session** at 60 fps, with the webcam preview on (**SHOW CAMERA**), so the timings below can
      be read off frame by frame afterwards.
- [ ] Record the build: `git rev-parse --short HEAD`, browser version, device, lighting.

## The §3 metrics

| # | Metric | Target | How to measure by hand | Automated proxy (scripted hands) | Result |
|---|---|---|---|---|---|
| 1 | Completed moves (extract + place + stable) per new player in 5 min | ≥ 3 | Start a stopwatch at the first Classic game (tutorial included). Read the score at 5:00. A new game after a collapse counts on: add up the scores. | `e2e/score.spec.ts` and `e2e/tutorial.spec.ts` complete a move: score 1 | |
| 2 | Grab success when pinching within 0.3 s of reaching a block | ≥ 95% | From the recording: each time the cursor turns cyan on a block and the player pinches within 0.3 s, count whether the block turns green (held). A red ring is a miss. Aim for 40+ attempts per player. | `e2e/grab.spec.ts`; `tests/physics/grabQuery.test.ts` (the query agrees with the cursor on 1000 samples) | |
| 3 | Unintended camera orbits per minute | 0 | Count each time the violet "turning the view" banner shows when the player didn't mean to turn the view (ask them right after, or note their reaction). Divide by minutes played. | `e2e/camera.spec.ts`: no approach orbits; letting go never turns the view | |
| 4 | Tower collapses caused by tracking dropouts or glitches | 0 | From the recording: for each collapse, check whether the preview shows the hand lost, jumping or misdetected just before it. Count those. | `tests/physics/trackingLoss.test.ts`, `e2e/trackingLoss.spec.ts` | |
| 5 | Delay from collapse to game-over feedback | ≤ 0.5 s | From the recording, frame by frame: the first frame a block leaves the tower, to the first frame of the game-over screen. | `tests/physics/fouls.test.ts`: every foul within 0.5 s of the fall | |
| 6 | React commits per second at rest with a hand present | ~0 | React DevTools → Profiler. Record 10 s with a hand held still in view, no block held. Count the commits. | `e2e/renders.spec.ts`: 0 commits in 3 s at rest and 2.5 s moving | |
| 7 | `detectForVideo` calls per second ÷ camera fps | 1.0 | DevTools → Performance, 10 s with a hand in view. Count `detectForVideo` calls, and compare with the camera's frame rate (`chrome://media-internals`, or the track's `getSettings().frameRate`). Do it on a 120 Hz display if there is one. | `e2e/inference.spec.ts`: no duplicate detection on any camera frame | |
| 8 | Time to interactive on 4G (first visit) | Start screen < 2 s; progress shown | DevTools → Network → "Fast 4G", cache disabled, a fresh profile. Time to the start screen, then to the first tracked hand. Note what the player sees meanwhile: the only indicator is the "Loading hand tracking…" chip, with no progress. | `e2e/assets.spec.ts` (all assets self-hosted). Bundle splitting (M-3), a progress indicator and a Service Worker (O-2) were not done. | |
| 9 | Page errors during a 10-minute soak (including resets) | 0 | DevTools console open. Play for 10 min: at least 5 collapses, 5 **RESET TOWER**s in Sandbox, 3 exits and re-entries, the tutorial replayed once, and the background switched both ways. Count red errors. | `e2e/reset.spec.ts` (20 grab → reset → release cycles); the grab, tracking-loss and mirror specs also fail on a page error | |

## Things only real hands can answer

These were changed without a real-hand measurement. Each needs a verdict.

- [ ] **Depth direction (H-3).** Half the players start on **TOWARD YOU** (the default), half on **INTO THE SCENE**.
      Without telling them which, ask after 3 minutes whether reaching for the tower felt natural. Swap and ask again.
      Pick the default from the answers.
- [ ] **Calibration (H-4).** Does **CALIBRATE (5 S)** make the far blocks reachable for every player? Note the players
      who still can't reach the back row.
- [ ] **Camera-mode clutch (H-2).** The 400 ms still open palm and its 0.015 stillness band. Does it ever start by
      accident (metric 3)? Can every player start it on purpose within 3 tries?
- [ ] **Jitter and lag (H-6, H-7).** Hold the cursor on one block for 5 s: does it stay on it? Does the hand feel like
      it lags? Compare good and dim light.
- [ ] **Soft grab (G-1).** Does a careful pull of a loose block feel controllable? Does a fast pull slip as intended,
      or feel like a bug?
- [ ] **Paused pulls (known bug).** Headless, a loose block held just short of clear levers its neighbours past
      0.5. How often do players pause there, and does the tower visibly shift when they do?
- [ ] **Loose blocks (C-6).** Without being told about them, do players discover that probing finds the loose block?
      After the tutorial (which says so), do they use it?
- [ ] **Gravity ×2 (P-2).** Do falls and collapses still look natural, not too fast?
- [ ] **Upper-level drag (known bug).** Pull a block from levels 12–15. Note how often the levels above come along.
- [ ] **Tutorial pacing (O-1).** Time each step per player. Note where anyone stalls for over 20 s, and anyone who
      skips it.
- [ ] **Placement (C-3, G-6).** Does the ghost slot make placing on top easy? How many tries does the first placement
      take?
- [ ] **Mirror AR (feature #10).** Turn on **SETTINGS → BACKGROUND → YOUR CAMERA**:
  - [ ] Does the virtual pinch point sit on the real fingertips?
  - [ ] On a phone in portrait, the image is squeezed (up to ~2.9× with a landscape camera). Does it bother players?
  - [ ] Do players prefer it to the studio?
- [ ] **Layouts (M-5).** On the phone, in portrait and landscape: is anything clipped or hard to tap? Can the hand
      reach every screen edge?
- [ ] **Camera errors (O-4).** Deny the camera permission once, and open the game while another app holds the camera.
      Is each message clear about what to do?

## Recording sheet

| Player | Device / orientation | Light | Moves in 5 min | Grab success | Unintended orbits | Tracking collapses | Notes |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |
| 4 | | | | | | | |
| 5 | | | | | | | |
| 6 | | | | | | | |
| 7 | | | | | | | |
| 8 | | | | | | | |
