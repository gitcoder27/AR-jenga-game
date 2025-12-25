# Track Specification: Phase 1: Foundation & "The Ghost Hand"

## Goal
Establish the project structure and get a stable 3D hand moving on screen controlled by the webcam. No physics yet, just tracking.

## Objectives
1.  **Project Setup:** Initialize a React project with Vite and install necessary dependencies (Three.js, React Three Fiber, MediaPipe, Zustand).
2.  **MediaPipe Integration:** Implement a webcam component and a service to feed video frames to MediaPipe's Hand Landmarker.
3.  **Coordinate Normalization:** Convert 2D webcam coordinates to 3D world coordinates, inverting the X-axis for mirroring.
4.  **Virtual Hand Rig:** Render visual debug spheres for hand landmarks and implement Z-axis depth logic based on hand size.
5.  **Smoothing:** Apply Linear Interpolation (Lerp) to remove webcam jitter.

## Deliverables
*   A blank 3D screen where a virtual skeletal hand follows the user's real hand smoothly in X, Y, and Z axes.
*   A functional React + Vite codebase with the tech stack configured.
*   Basic unit tests for coordinate transformation and state logic.

## Technical Considerations
*   **Performance:** MediaPipe should run efficiently in the browser.
*   **Coordinate System:** Ensure correct mapping between the 2D video feed and the 3D scene (aspect ratio, FOV).
*   **Z-Axis Estimation:** Tune the depth calculation (Wrist to Middle Finger MCP distance) to feel natural.
