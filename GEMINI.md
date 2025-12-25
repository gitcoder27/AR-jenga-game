# AR Jenga Game

## Project Overview

This project is a **Web-based Augmented Reality Jenga Game** that allows users to interact with a 3D Jenga tower using hand gestures captured via webcam. It leverages sophisticated technologies to bridge the gap between physical movements and virtual physics.

### Core Features
*   **Real-time Hand Tracking:** Uses MediaPipe to track 21 hand landmarks.
*   **Physics Simulation:** Realistic rigid body physics (mass, friction, collision) via Rapier.js.
*   **Gesture Control:** Natural interactions for moving, pushing, and grabbing blocks (pinch to grab).
*   **Immersive Environment:** 3D studio setting with dynamic lighting and shadows.

## Tech Stack

*   **Language:** TypeScript
*   **Frontend:** React 19, Vite
*   **3D Engine:** Three.js, React Three Fiber (R3F)
*   **Physics:** React Three Rapier (Rapier engine)
*   **Computer Vision:** MediaPipe Tasks Vision (Client-side ML)
*   **State Management:** Zustand
*   **Testing:** Vitest, React Testing Library

## Key Commands

*   `npm run dev`: Starts the local development server (usually at `http://localhost:5173`).
*   `npm run build`: compiles TypeScript and builds the application for production.
*   `npm run test`: Runs the test suite using Vitest.
*   `npm run lint`: Checks the codebase for linting errors using ESLint.

## Directory Structure

*   `conductor/`: Project management documentation, product specs, and tracking plans.
*   `src/components/`:
    *   **3D Components:** `Block.tsx`, `Tower.tsx`, `Hand.tsx`, `StudioRoom.tsx`, `Lighting.tsx`.
    *   **UI Components:** `HUD/`, `StartScreen/`.
    *   **Core:** `App.tsx`, `main.tsx`.
*   `src/hooks/`: Logic encapsulation.
    *   `useHandTracking.ts`: MediaPipe integration.
    *   `useGesture.ts`: Pinch/grab detection logic.
*   `src/store/`: Global state management (`gameStore.ts`).
*   `src/utils/`: Mathematical helpers (`coordinates.ts`, `depth.ts`, `smoothing.ts`).

## Development Conventions

*   **Architecture:**
    *   **3D/Logic Separation:** Physics and rendering logic are handled by R3F components, while game state is centralized in Zustand stores.
    *   **Hooks Pattern:** Complex logic (like hand tracking and gesture recognition) is extracted into custom React hooks.
*   **Styling:** CSS files are co-located with components (e.g., `HUD.css`, `StartScreen.css`).
*   **Testing:**
    *   Unit tests are co-located with source files (e.g., `Block.test.tsx` next to `Block.tsx`).
    *   Test logic focuses on game mechanics and component rendering.
*   **Type Safety:** Strict TypeScript usage is enforced, particularly for vector math and physics properties.
