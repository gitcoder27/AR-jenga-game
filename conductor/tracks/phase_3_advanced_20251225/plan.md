# Track Plan: Phase 3: Advanced Interaction & Game Logic

## Phase 3.1: Pinch Detection System
- [x] Task: Implement Pinch Logic
    - [x] Sub-task: Write Tests: Unit test for distance calculation and boolean state trigger
    - [x] Sub-task: Create `useGesture` hook or update `useHandTracking` to detect distance between Thumb Tip (4) and Index Tip (8)
- [x] Task: Hand Visual Feedback
    - [x] Sub-task: Update `Hand.tsx` to change material color based on `isPinching` state
- [x] Task: Conductor - User Manual Verification 'Phase 3.1: Pinch Detection System' (Protocol in workflow.md)

## Phase 3.2: Grabbing Mechanics
- [x] Task: Implement Grabbing Physics
    - [x] Sub-task: Write Tests: Verify joint creation/destruction logic
    - [x] Sub-task: Implement logic to find the closest block to the pinch point
    - [x] Sub-task: Use `@react-three/rapier` `useFixedJoint` or equivalent to link hand and block
- [x] Task: Release Logic
    - [x] Sub-task: Ensure the joint is destroyed and block becomes dynamic again when pinch released
- [x] Task: Conductor - User Manual Verification 'Phase 3.2: Grabbing Mechanics' (Protocol in workflow.md)

## Phase 3.3: Game State & Win/Loss Logic
- [ ] Task: Implement Game Store
    - [ ] Sub-task: Create `useGameStore` (Zustand) to track `gameState` (PLAYING, GAME_OVER), `score`, and `heldBlockId`
- [ ] Task: Loss Detection
    - [ ] Sub-task: Update `Block.tsx` or `Tower.tsx` to detect collision with floor
    - [ ] Sub-task: Trigger `GAME_OVER` if a non-held block hits the floor
- [ ] Task: Game UI
    - [ ] Sub-task: Add "Game Over" overlay and "Reset Game" button to `App.tsx`
- [ ] Task: Conductor - User Manual Verification 'Phase 3.3: Game State & Win/Loss Logic' (Protocol in workflow.md)
