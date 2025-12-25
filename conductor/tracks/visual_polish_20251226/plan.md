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

## Phase 2: Textures & Materials (Blocks)
- [ ] Task: Implement Wood Material
    - [ ] Create `utils/materials.ts` or similar to manage shared materials.
    - [ ] Create `test/materials.test.ts`.
    - [ ] Load textures (Albedo, Normal, Roughness) - *Self-correction: Use placeholder/procedural textures if assets not available, or standard Drei materials.*
    - [ ] Update `Block.tsx` to use the new wood material logic.
    - [ ] Ensure `castShadow` and `receiveShadow` are true on Blocks.
- [ ] Task: Conductor - User Manual Verification 'Textures & Materials (Blocks)' (Protocol in workflow.md)

## Phase 3: Hand Model Integration
- [ ] Task: Implement Robotic Hand Model
    - [ ] Create `components/RoboticHand.tsx`.
    - [ ] Create `components/RoboticHand.test.tsx`.
    - [ ] *Implementation Strategy:* Since we might not have an external GLB ready, proceed with a "Programmatic" Robotic Hand using Three.js primitives (Cylinders/Boxes) grouped to look mechanical.
    - [ ] Map the 21 MediaPipe landmarks to the robotic joints/segments.
    - [ ] Ensure smooth updates (reuse existing `smoothing.ts`).
- [ ] Task: Integration with Game Logic
    - [ ] Replace `Hand.tsx` (debug spheres) with `RoboticHand.tsx` in the main scene.
    - [ ] Verify physics interactions remain accurate (the visual hand aligns with the physics hand).
- [ ] Task: Conductor - User Manual Verification 'Hand Model Integration' (Protocol in workflow.md)

## Phase 4: UI & HUD Polish
- [ ] Task: Minimal HUD Architecture
    - [ ] Create `components/HUD/HUD.tsx`.
    - [ ] Create `components/HUD/HUD.test.tsx`.
    - [ ] Implement `WebcamFeed` component (hidden by default, togglable via state).
    - [ ] Implement `InstructionsOverlay` component (auto-fade out after N seconds).
    - [ ] Implement `GameOverModal` component (styled professionally).
- [ ] Task: Integration & State Management
    - [ ] Update `gameStore.ts` to handle UI states (isWebcamVisible, isInstructionsVisible).
    - [ ] Wire up HUD components to the store.
- [ ] Task: Conductor - User Manual Verification 'UI & HUD Polish' (Protocol in workflow.md)
