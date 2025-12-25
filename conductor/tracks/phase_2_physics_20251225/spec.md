# Track Specification: Phase 2: The Physics Core

## Overview
This track focuses on implementing the core physics engine and the Jenga tower simulation. The goal is to transition from a visual-only hand tracking demo to an interactive physics environment where the virtual hand can collide with and manipulate game objects.

## Functional Requirements
1.  **Physics Engine Integration:**
    *   Integrate `@react-three/rapier` into the scene.
    *   Configure global physics settings: Gravity `[0, -9.81, 0]`.
    *   Add a static ground plane with high friction to serve as the table.

2.  **Tower Generation:**
    *   Implement a procedural generation algorithm to create a standard Jenga tower (54 blocks, 18 levels).
    *   **Arrangement:** 3 blocks per level, alternating orientation (0 and 90 degrees) for each level.
    *   **Imperfection:** Apply slight random jitter (position/rotation offsets) to block placement for realism and physics stability.

3.  **Block Physics Properties:**
    *   **Mass:** High (1.0) to simulate wood density.
    *   **Friction:** High (0.8) to prevent unnatural sliding.
    *   **Restitution:** Zero (0.0) to prevent bouncing.

4.  **Hand-Physics Interaction:**
    *   Upgrade the "Ghost Hand" from Phase 1.
    *   Attach **Kinematic Rigidbody** colliders (spheres/capsules) to the fingertips (or all joints).
    *   Ensure the kinematic hand pushes dynamic blocks but is not affected by them.

## Non-Functional Requirements
*   **Performance:** The physics simulation must run at 60 FPS. Use "sleeping" for blocks not currently moving.
*   **Stability:** The tower must not collapse or jitter spontaneously upon initialization.

## Acceptance Criteria
*   A 54-block Jenga tower is generated in the center of the scene.
*   The tower is stable (doesn't explode or fall over on start).
*   Moving the user's real hand moves the virtual hand, and the virtual hand can knock over the tower by colliding with it.
