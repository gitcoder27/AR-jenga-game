# Track Specification: Phase 3: Advanced Interaction & Game Logic

## Overview
This track implements the core gameplay mechanics that turn the physics simulation into a game. The primary focus is enabling the user to pick up and place blocks using a "Pinch" gesture and establishing the win/loss conditions.

## Functional Requirements
1.  **Pinch Detection:**
    *   Calculate the Euclidean distance between the **Thumb Tip** and **Index Finger Tip**.
    *   Define a threshold (e.g., 2cm or 0.05 world units) to trigger `isPinching` state.
    *   **Visual Feedback:** Change the virtual hand color (e.g., from Pink to Blue) when `isPinching` is true.

2.  **Grabbing Mechanic:**
    *   **Raycasting/Collision:** Detect if the midpoint of the pinch is colliding with or intersecting a Jenga block.
    *   **Physics Lock:** When `isPinching` is true AND a block is targeted:
        *   Create a **Fixed Joint** between the Hand (Kinematic Body) and the Block (Dynamic Body).
        *   Wake up the block if it is sleeping.
    *   **Release:** When `isPinching` becomes false, destroy the joint to release the block.

3.  **Game State Management:**
    *   **Loss Condition:** Detect if any block touches the "Floor" (y < 0 or collision with ground plane).
    *   **Exception:** The block currently being held/moved by the user must NOT trigger a loss while held.
    *   **Reset:** Implement a function to reset the tower and game state.

4.  **UI Updates:**
    *   Display a simple "Game Over" message when the loss condition is met.
    *   Add a "Reset" button.

## Non-Functional Requirements
*   **Responsiveness:** The grab action must feel instantaneous.
*   **Stability:** The Fixed Joint must not cause the physics engine to explode (ensure masses are compatible or use a physics engine that handles kinematic-dynamic joints well).

## Acceptance Criteria
*   User can pinch thumb and index finger to change hand color.
*   User can pinch to pick up a block from the tower.
*   User can move the block and release it on top of the tower.
*   Dropping a block on the floor (or knocking the tower over) triggers a Game Over state.
