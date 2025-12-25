# Track Plan: Phase 1: Foundation & "The Ghost Hand"

## Phase 1.1: Project Setup
- [x] Task: Initialize React project with Vite and TypeScript
    - [x] Sub-task: Create new Vite project
    - [x] Sub-task: Clean up boilerplate
- [x] Task: Install Dependencies
    - [x] Sub-task: Install `three`, `@react-three/fiber`, `@react-three/drei`
    - [x] Sub-task: Install `@mediapipe/tasks-vision`
    - [x] Sub-task: Install `zustand`
- [~] Task: Conductor - User Manual Verification 'Phase 1.1: Project Setup' (Protocol in workflow.md)

## Phase 1.2: MediaPipe Integration
- [x] Task: Create Webcam Component
    - [x] Sub-task: Write Tests: Verify component renders video element and requests permissions
    - [x] Sub-task: Implement hidden video element with permission handling
- [x] Task: Implement Hand Landmarker Service
    - [x] Sub-task: Write Tests: Mock MediaPipe and verify initialization
    - [x] Sub-task: Implement service to load model and process video frames
- [x] Task: Coordinate Normalization Logic
    - [x] Sub-task: Write Tests: Unit tests for 2D to 3D coordinate conversion functions (including X-axis inversion)
    - [x] Sub-task: Implement coordinate transformation utility
- [~] Task: Conductor - User Manual Verification 'Phase 1.2: MediaPipe Integration' (Protocol in workflow.md)

## Phase 1.3: The Virtual Hand Rig
- [x] Task: Create Visual Debugger (Hand Component)
    - [x] Sub-task: Write Tests: Verify component renders correct number of joint spheres based on input
    - [x] Sub-task: Implement R3F component to render spheres at landmark positions
- [x] Task: Implement Z-Axis Depth Logic
    - [x] Sub-task: Write Tests: Unit tests for depth calculation (Wrist to Middle Finger MCP distance)
    - [x] Sub-task: Implement depth estimation logic
- [x] Task: Implement Movement Smoothing (Lerp)
    - [x] Sub-task: Write Tests: Unit tests for Lerp function ensuring smooth transition
    - [x] Sub-task: Apply Lerp to landmark coordinates in the update loop
- [~] Task: Conductor - User Manual Verification 'Phase 1.3: The Virtual Hand Rig' (Protocol in workflow.md)
