# Implementation Plan: phase_5_optimization_deployment

## Phase 1: Physics & Rendering Optimization
Goal: Ensure the game maintains 60 FPS by reducing CPU/GPU load.
- [x] **Task: Research Rapier Sleep Thresholds**
  - Read Rapier documentation to identify the best parameters for "sleeping" static objects in a Jenga context.
  - *Findings: Use `canSleep={true}` on RigidBody. Default thresholds are usually sufficient, but can be tuned.*
- [x] **Task: Implement Physics Sleep in `Tower`**
  - Write tests in `src/components/Tower.test.tsx` to verify that blocks are initialized with sleep enabled or enter sleep after settlement.
  - Update `src/components/Tower.tsx` to configure `RigidBody` sleep properties.
  - *Note: Implementing in `Block.tsx` as it contains the RigidBody definition.*
- [x] **Task: Refactor to `InstancedMesh`**
  - Write performance benchmarks or basic tests to ensure `InstancedMesh` correctly renders all blocks.
  - Refactor `src/components/Tower.tsx` to use `InstancedMesh` for rendering while maintaining individual `RigidBody` components for physics.
- [x] **Task: Conductor - User Manual Verification 'Phase 1: Physics & Rendering Optimization' (Protocol in workflow.md)**

## Phase 2: UX & Error Handling
Goal: Handle webcam permission issues gracefully.
- [x] **Task: Create Camera Permission Overlay**
  - Write tests in `src/components/Webcam.test.tsx` for a "denied" state.
  - Implement an overlay component that triggers when `navigator.mediaDevices.getUserMedia` fails.
- [x] **Task: Add Retry Logic**
  - Write tests to verify the "Retry" button re-attempts camera access.
  - Implement the "Retry" functionality in the `src/components/Webcam.tsx` component.
- [x] **Task: Conductor - User Manual Verification 'Phase 2: UX & Error Handling' (Protocol in workflow.md)**

## Phase 3: Final Build & Local Deployment
Goal: Verify the app is ready for local production use.
- [x] **Task: Production Build Verification**
  - Run `npm run build` and ensure no TypeScript or Vite errors.
  - Test the resulting `dist/` folder using `npm run preview`.
- [x] **Task: Conductor - User Manual Verification 'Phase 3: Final Build & Local Deployment' (Protocol in workflow.md)**
