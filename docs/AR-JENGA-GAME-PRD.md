# Product Requirements Document (PRD)

**Project Name:** Virtual Hand Jenga (Web-Based)
**Date:** 2025-08-14
**Version:** 1.0

## 1. Executive Summary

A browser-based 3D simulation of the classic game "Jenga" controlled entirely via webcam hand gestures. The game takes place in a fully 3D virtual environment. The user's real-life hand movements control a "virtual hand" on screen to push, pinch, and pull blocks. The focus is on high-fidelity physics and smooth, satisfying graphics.

## 2. Core Gameplay & Mechanics

### 2.1 The Virtual Environment

* **Scene:** A high-quality 3D table set in a relaxed, aesthetic room (e.g., a lo-fi study room or a neon minimalist void).
* **The Tower:** A standard Jenga tower (54 blocks, arranged in 18 levels of 3).
* **Camera:** Fixed perspective (User sitting at the table) but allows slight rotation/orbit to see the tower from angles (controlled by head movement or UI buttons).

### 2.2 Control Scheme (The "Hand")

The user's hand is tracked via webcam. A virtual "Ghost Hand" or "Robotic Hand" mirrors the user's movements on screen.

* **Movement:** Moving the physical hand left/right/up/down/forward/back moves the virtual hand in 3D space.
* **Depth Control (Z-axis):** Since webcams are 2D, depth is calculated by the **size of the hand** (closer hand = larger = move forward in game) or a fixed "reach" threshold.

### 2.3 Interaction Modes (Hybrid)

1. **Physics Push (Default):** The virtual hand is a solid physics object. If the user moves their hand into a block, the finger collides with it and pushes it. Good for tapping blocks loose.
2. **Pinch & Grab:**
* **Trigger:** User pinches Index Finger + Thumb together.
* **Action:** If the virtual hand is touching a block, the block "sticks" to the fingers.
* **Release:** User opens fingers to release the block (e.g., to place it on top of the tower).



### 2.4 Winning/Losing

* **Loss:** Any block other than the one currently being moved falls off the tower.
* **Win:** (Optional) Reach a certain height or High Score based on blocks stacked.

---

## 3. Technical Stack Recommendation

To achieve "top-notch physics" while keeping development manageable, this is the recommended stack:

| Component | Technology | Why? |
| --- | --- | --- |
| **3D Engine** | **Three.js** | The standard for web 3D. Massive community, tons of examples, and excellent performance. |
| **Physics Engine** | **Rapier.js** (or Havok) | **Crucial Choice.** Standard engines (Cannon.js) are too "jittery" for Jenga. Rapier is WASM-based (super fast) and stable, preventing blocks from vibrating out of place. |
| **Hand Tracking** | **MediaPipe Hands** | Google's best-in-class, lightweight tracking. Runs smoothly in the browser without backend servers. |
| **Framework** | **React + React Three Fiber** | Makes managing the game state (UI, score, win/loss) much easier than vanilla JS. |

---

## 4. Functional Requirements

### 4.1 Physics Engine (The "Heart" of the Game)

* **Friction:** Blocks must have high friction (wood material) so they don't slide off like ice.
* **Sleeping:** Blocks that are not moving must "sleep" (stop calculating physics) to save CPU and prevent jitter. They "wake up" only when touched.
* **CCD (Continuous Collision Detection):** Must be enabled for the hand/fingers to prevent the virtual hand from "phasing through" blocks if the user moves too fast.

### 4.2 Hand Tracking Logic

* **Smoothing:** Raw webcam data is shaky. You must implement a "Lerp" (Linear Interpolation) function to make the virtual hand movement look buttery smooth.
* **Calibration:** On startup, ask the user to show their open hand to calibrate the "zero" position.

### 4.3 Visual Fidelity

* **Lighting:** Use PBR (Physically Based Rendering) lighting. Soft shadows and ambient occlusion (shadows in cracks) to make the tower look grounded.
* **Textures:** High-resolution wood grain textures with "Normal Maps" (gives 3D texture to the wood surface).

---

## 5. User Interface (UI)

* **HUD:** Minimalist. Shows "Stability %" (how much the tower is wobbling).
* **Video Feed:** A small picture-in-picture view of the user's real webcam feed in the corner (so they can see if their hand is out of frame).
* **Start Screen:** "Allow Camera Access" prompt -> Calibration -> "Start Game".

---

## 6. Development Roadmap (Step-by-Step)

### Phase 1: The "Invisible" Prototype

1. Set up a blank Three.js scene.
2. Integrate MediaPipe. Get the console to log hand coordinates (x, y, z).
3. Map those coordinates to a simple Red Cube in the 3D world. Make the Red Cube follow your hand.

### Phase 2: The Physics Lab

1. Integrate Rapier.js.
2. Create a stack of 3 blocks.
3. Make the Red Cube (Hand) a "Kinematic RigidBody" (an object that pushes others but isn't pushed back).
4. Test pushing the blocks. Tune friction and mass until it feels "heavy" and realistic.

### Phase 3: The Game Logic

1. Build the full 54-block tower algorithm.
2. Implement the "Pinch" gesture logic (detect distance between thumb tip and index tip).
3. Add logic: If pinch = true AND colliding with block -> create "Fixed Joint" between hand and block.

### Phase 4: Polish

1. Replace the Red Cube with a 3D Hand Model.
2. Add wood textures and lighting.
3. Add sound effects (wood scraping, heavy thud on table).
