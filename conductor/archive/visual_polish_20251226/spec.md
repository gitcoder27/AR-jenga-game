# Phase 4: Visual Polish & Atmosphere

## 1. Overview
This phase focuses on elevating the visual quality of the AR Jenga game from a functional prototype to a polished product. We will implement a professional "Studio" environment, realistic wood textures for the blocks, a robotic hand model for user interaction, and a minimal, non-intrusive UI.

## 2. Functional Requirements

### 2.1 Environment & Lighting
*   **HDR Lighting:** Implement High Dynamic Range (HDR) lighting using an environment map to provide realistic reflections and lighting.
*   **Style:** "Studio / Clean" atmosphere. Neutral, professional lighting that highlights the game elements without distraction.
*   **Shadows:** Enable soft shadows. The hand and blocks must cast shadows on the table/floor to provide essential depth cues for the player.
*   **Room Model:** Add a minimal background or "studio backdrop" to ensure the tower is not floating in a void, consistent with the clean aesthetic.

### 2.2 Textures & Materials
*   **Blocks:** Apply a "Natural / Raw" wood texture to the Jenga blocks.
    *   Must include Albedo (color), Normal (bump), and Roughness maps for realism.
    *   Finish should be matte/raw, not high-gloss.
*   **Hand Model:** Replace the current debug spheres/skeletal lines with a **Robotic / Cybernetic Hand** model.
    *   The model should correspond to the existing physics/tracking rig.
    *   Visual contrast against the wood blocks should be high (e.g., metal, white plastic, dark carbon).

### 2.3 UI Overlay (HUD)
*   **Style:** "Minimal / Contextual".
*   **Webcam Feed:** Toggle-only (hidden by default to keep the interface clean).
*   **Instructions:** Display briefly at the start and then fade out.
*   **Game Over:** Centered modal/overlay that appears only when the loss condition is met.

## 3. Non-Functional Requirements
*   **Performance:** Maintain 60 FPS. High-resolution textures should be optimized/compressed (e.g., .jpg or .webp for textures, Draco for models).
*   **Asset Loading:** Ensure assets (HDRi, Textures, Models) are preloaded or have a loading state to prevent "popping" in.

## 4. Acceptance Criteria
*   [ ] The scene renders with HDR lighting and soft shadows.
*   [ ] Blocks look like natural wood with visible grain and react to light.
*   [ ] The user's hand is represented by a 3D robotic hand model that tracks movement smoothly.
*   [ ] The UI is minimal: Instructions fade out, webcam is hidden by default, and Game Over screen appears correctly.
*   [ ] Performance remains smooth on the target test device.

## 5. Out of Scope
*   Complex multi-room environments.
*   Custom avatar customization (changing hand colors/skins).
*   Sound effects (Audio is not explicitly mentioned in this visual polish phase).
