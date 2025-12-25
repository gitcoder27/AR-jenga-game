# Technology Stack

## Frontend Framework
*   **React:** The core library for building the user interface and managing component lifecycles.
*   **Vite:** A fast build tool and development server, chosen for its superior performance over Create React App.
*   **Language:** **TypeScript**. Strongly typed JavaScript is essential for a 3D physics project to ensure type safety with vector math and complex state management.

## 3D & Physics Engine
*   **Three.js:** The underlying WebGL engine for 3D rendering.
*   **React Three Fiber (R3F):** A React renderer for Three.js, allowing declarative scene construction.
*   **Rapier.js (`@react-three/rapier`):** A high-performance, WASM-based physics engine. Chosen for its stability and determinism, which is critical for stacking simulations like Jenga.

## Computer Vision / AR
*   **MediaPipe Hands (`@mediapipe/tasks-vision`):** Google's machine learning solution for high-fidelity hand and finger tracking. It runs entirely client-side in the browser.

## State Management
*   **Zustand:** A small, fast, and scalable bearbones state-management solution. It will handle game states (score, win/loss, current turn) without the boilerplate of Redux.

## Utilities
*   **`@react-three/drei`:** A collection of useful helpers for R3F (OrbitControls, Environment, etc.) to speed up development.

## Testing & Quality Assurance
*   **Vitest:** A blazing fast unit test framework powered by Vite.
*   **React Testing Library:** For testing React components in a way that resembles how they are used by end users.
