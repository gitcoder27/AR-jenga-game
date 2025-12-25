# Track Specification: phase_5_optimization_deployment

## Overview
The final phase focuses on transitioning the AR Jenga game from a functional prototype to a polished, performant local application. The primary goals are reaching a stable 60 FPS on desktop hardware and providing a robust user experience for webcam setup.

## Functional Requirements
1. **Performance Optimization**
    * Enable and configure "Sleep" thresholds in the Rapier physics engine to stop calculating physics for stationary blocks.
    * Refactor the `Tower` component to use `InstancedMesh` if it provides significant performance gains over individual `Block` components.
2. **Webcam & Permission Handling**
    * Implement an overlay that detects when camera permissions are denied or unavailable.
    * Provide clear instructions to the user on how to enable the camera and a "Retry" button.
3. **Local "Deployment" Readiness**
    * Ensure all assets (textures, hand model) are loaded efficiently.
    * Verify that the `npm run build` and `npm run preview` commands work without errors for local distribution.

## Non-Functional Requirements
* **Performance:** Maintain 60 FPS on modern desktop browsers.
* **Reliability:** The game should not crash if the camera is disconnected or blocked.

## Acceptance Criteria
* [ ] The game runs at 60 FPS during a full tower collapse.
* [ ] Blocks that are not moving are put to sleep by the physics engine (verified via debug or performance profiling).
* [ ] A "Camera Required" overlay appears if the user denies camera access.
* [ ] The project builds successfully using `npm run build`.

## Out of Scope
* Public hosting (Vercel/Netlify/GitHub Pages).
* Mobile browser optimization.
* Game analytics or social sharing features.
