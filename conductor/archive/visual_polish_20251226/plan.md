# Implementation Plan - Visual Polish & Atmosphere (Phase 4)

## Phase 1: Environment & Lighting
- [x] Task: Configure HDR Environment
    - [x] Create `test/Environment.test.tsx` to verify component rendering and props.
    - [x] Implement `EnvironmentSetup` component using `@react-three/drei`'s `Environment`.
    - [x] Configure `background` prop to `false` (we will use a custom model/color).
    - [x] Set `preset` to 'studio' (or load custom HDR if needed later).
- [x] Task: Configure Shadows & Lights
    - [x] Update `App.tsx` / `Canvas` to enable `shadows`.
    - [x] Create/Update `Lighting.tsx` component.
    - [x] Add `DirectionalLight` with `castShadow`.
    - [x] Configure shadow bias and map size for "soft shadow" look.
    - [x] Verify shadows on existing Table/Floor.
- [x] Task: Add Studio Backdrop
    - [x] Create `components/StudioRoom.tsx`.
    - [x] Create `components/StudioRoom.test.tsx`.
    - [x] Implement a simple curved backdrop or "infinity wall" geometry.
    - [x] Apply a neutral, non-distracting material.
- [ ] Task: Conductor - User Manual Verification 'Environment & Lighting' (Protocol in workflow.md)

## Phase 1.5: Gameplay & Interaction Refinements (User Feedback)
- [x] Task: Fix Hand Tracking Range & Mapping
    - [x] Create `test/coordinates_range.test.ts` to verify mapping limits.
    - [x] Update `utils/coordinates.ts` to expand the mapped range (allow hand to reach edges/corners).
    - [x] Verify hand can travel fully across the scene.
- [x] Task: Enhance Depth Perception (Z-Axis)
    - [x] Create `components/DepthCursor.tsx`.
    - [x] Implement a visual guide (e.g., a semi-transparent ring) projected on the table/floor at the hand's [x, 0, z] position.
    - [x] Ensure the cursor is visible only when hand is tracked.
- [x] Task: Refine Physics & Grabbing
    - [x] Update `Hand.tsx` (or `RoboticHand.tsx` later) logic.
    - [x] Add damping to the held block to reduce jitter.
    - [x] Experiment with `mass` properties in `Block.tsx`.
- [x] Task: Fix Game Over Logic
    - [x] Update `store/gameStore.ts` logic.
    - [x] Logic change: Ignore collision with floor if the block is currently "held" (pinched) or was just released by the user (grace period?).
    - [x] Ensure Game Over only triggers if *non-held* blocks hit the floor.
- [ ] Task: Conductor - User Manual Verification 'Gameplay & Interaction Refinements' (Protocol in workflow.md)

## Phase 1.6: Fine-tuning Input Mapping & Cursors (User Feedback)
- [x] Task: Fix Bottom Screen Mapping
    - [x] Update `utils/coordinates.ts` to increase Y-axis range or offset.
    - [x] Verify Y=1 (bottom of webcam) maps to lower World Y coordinate.
- [x] Task: Align Cursor with Pinch Point
    - [x] Update `components/DepthCursor.tsx` to calculate position based on Index Tip and Thumb Tip midpoint.
    - [x] Ensure cursor follows the "fingers" not the "wrist".
- [ ] Task: Conductor - User Manual Verification 'Fine-tuning Input Mapping & Cursors' (Protocol in workflow.md)

## Phase 2: Textures & Materials (Blocks)
- [x] Task: Implement Wood Material
    - [x] Create `utils/materials.ts` or similar to manage shared materials.
    - [x] Create `test/materials.test.ts`.
    - [x] Load textures (Albedo, Normal, Roughness) - *Self-correction: Use placeholder/procedural textures if assets not available, or standard Drei materials.*
    - [x] Update `Block.tsx` to use the new wood material logic.
    - [x] Ensure `castShadow` and `receiveShadow` are true on Blocks.
- [ ] Task: Conductor - User Manual Verification 'Textures & Materials (Blocks)' (Protocol in workflow.md)
- [ ] Task: Conductor - User Manual Verification 'Textures & Materials (Blocks)' (Protocol in workflow.md)

## Phase 2.5: Block Visual Distinction (User Feedback)
- [x] Task: Switch to RoundedBox
    - [x] Update `Block.tsx` to use `RoundedBox` from `@react-three/drei`.
    - [x] Set `radius` (bevel) to a small value (e.g., 0.05).
- [x] Task: Randomize Block Colors
    - [x] Update `Block.tsx` to apply slight random variation to the base wood color.
    - [x] Ensures blocks are distinguishable even from a distance.
- [ ] Task: Conductor - User Manual Verification 'Block Visual Distinction' (Protocol in workflow.md)

## Phase 3: Hand Model Integration
- [x] Task: Implement Robotic Hand Visuals
    - [x] Update `Hand.tsx` to render "Bones" (cylinders) connecting landmarks.
    - [x] Create `components/HandBone.tsx` to handle looking at/scaling between two points.
    - [x] Stylize joints (RigidBodies) to look mechanical (e.g., metallic material).
- [x] Task: Integration with Game Logic
    - [x] Ensure physics colliders (tips) remain accurate.
    - [x] Verify visual alignment with physics.
- [x] Task: Conductor - User Manual Verification 'Hand Model Integration' (Protocol in workflow.md)

## Phase 4: UI & HUD Polish
- [x] Task: Minimal HUD Architecture
    - [x] Create `components/HUD/HUD.tsx`.
    - [x] Create `components/HUD/HUD.test.tsx`.
    - [x] Implement `WebcamFeed` component (hidden by default, togglable via state).
    - [x] Implement `InstructionsOverlay` component (auto-fade out after N seconds).
    - [x] Implement `GameOverModal` component (styled professionally).
- [x] Task: Integration & State Management
    - [x] Update `gameStore.ts` to handle UI states (isWebcamVisible, isInstructionsVisible).
    - [x] Wire up HUD components to the store.
- [x] Task: Conductor - User Manual Verification 'UI & HUD Polish' (Protocol in workflow.md)

## Phase 4.1: HUD & Webcam Stability (User Feedback)
- [x] Task: Fix Webcam Flickering
    - [x] Memoize `onVideoReady` in `App.tsx` to prevent unnecessary re-initializations.
- [x] Task: Adjust Instructions Position
    - [x] Move instructions higher in `HUD.css` to avoid overlap with the tower.
    - [x] Ensure HUD renders on top of the Canvas.
- [x] Task: Conductor - User Manual Verification 'HUD & Webcam Stability' (Protocol in workflow.md)

## Phase 4.2: Interaction & Mapping Final Polish (User Feedback)
- [x] Task: Expand Hand Tracking Range
    - [x] Update `utils/coordinates.ts` with sensitivity (1.1x) and Y-offset (8.5) to cover visible area and corners.
    - [x] Calibrate bounds to stay within visible frustum above table.
- [x] Task: Tweak Smoothing
    - [x] Set smoothing to 0.12 in `Hand.tsx` for better stability.
- [x] Task: Conductor - User Manual Verification 'Interaction & Mapping Final Polish' (Protocol in workflow.md)

## Phase 4.3: Hand Spawning & Teleport Fix (User Feedback)
- [x] Task: Implement Hand Parking
    - [x] Initialize hand and cursor positions at `[0, -100, 0]` to avoid tower collisions.
    - [x] Hide hand/cursor when tracking is lost.
- [x] Task: Instant Teleport Logic
    - [x] Snaps hand to position on the first frame of detection to bypass smoothing slide.
- [x] Task: Conductor - User Manual Verification 'Hand Spawning Fix' (Protocol in workflow.md)

## Phase 5: Optimization & Deployment
