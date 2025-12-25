# Track Plan: Phase 1: Foundation & "The Ghost Hand"

## Phase 1.1: Project Setup
- [ ] Task: Initialize React project with Vite and TypeScript
    - [ ] Sub-task: Create new Vite project
    - [ ] Sub-task: Clean up boilerplate
- [ ] Task: Install Dependencies
    - [ ] Sub-task: Install `three`, `@react-three/fiber`, `@react-three/drei`
    - [ ] Sub-task: Install `@mediapipe/tasks-vision`
    - [ ] Sub-task: Install `zustand`
- [ ] Task: Conductor - User Manual Verification 'Phase 1.1: Project Setup' (Protocol in workflow.md)

## Phase 1.2: MediaPipe Integration
- [ ] Task: Create Webcam Component
    - [ ] Sub-task: Write Tests: Verify component renders video element and requests permissions
    - [ ] Sub-task: Implement hidden video element with permission handling
- [ ] Task: Implement Hand Landmarker Service
    - [ ] Sub-task: Write Tests: Mock MediaPipe and verify initialization
    - [ ] Sub-task: Implement service to load model and process video frames
- [ ] Task: Coordinate Normalization Logic
    - [ ] Sub-task: Write Tests: Unit tests for 2D to 3D coordinate conversion functions (including X-axis inversion)
    - [ ] Sub-task: Implement coordinate transformation utility
- [ ] Task: Conductor - User Manual Verification 'Phase 1.2: MediaPipe Integration' (Protocol in workflow.md)

## Phase 1.3: The Virtual Hand Rig
- [ ] Task: Create Visual Debugger (Hand Component)
    - [ ] Sub-task: Write Tests: Verify component renders correct number of joint spheres based on input
    - [ ] Sub-task: Implement R3F component to render spheres at landmark positions
- [ ] Task: Implement Z-Axis Depth Logic
    - [ ] Sub-task: Write Tests: Unit tests for depth calculation (Wrist to Middle Finger MCP distance)
    - [ ] Sub-task: Implement depth estimation logic
- [ ] Task: Implement Movement Smoothing (Lerp)
    - [ ] Sub-task: Write Tests: Unit tests for Lerp function ensuring smooth transition
    - [ ] Sub-task: Apply Lerp to landmark coordinates in the update loop
- [ ] Task: Conductor - User Manual Verification 'Phase 1.3: The Virtual Hand Rig' (Protocol in workflow.md)
