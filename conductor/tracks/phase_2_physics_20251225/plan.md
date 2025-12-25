# Track Plan: Phase 2: The Physics Core

## Phase 2.1: Physics Engine Setup
- [x] Task: Install and Configure Rapier
    - [x] Sub-task: Install `@react-three/rapier`
    - [x] Sub-task: Write Tests: Verify Physics component renders and gravity is set
    - [x] Sub-task: Wrap the scene in `<Physics>` provider and set gravity
- [x] Task: Create Ground Plane
    - [x] Sub-task: Implement a static RigidBody floor with high friction
- [~] Task: Conductor - User Manual Verification 'Phase 2.1: Physics Engine Setup' (Protocol in workflow.md)

## Phase 2.2: The Tower Generator
- [x] Task: Create Jenga Block Component
    - [x] Sub-task: Write Tests: Verify block dimensions and physics properties (mass, friction, restitution)
    - [x] Sub-task: Implement `Block` component using `RigidBody` and `Box`
- [x] Task: Implement Tower Generation Algorithm
    - [x] Sub-task: Write Tests: Verify algorithm generates 54 blocks with correct alternating rotations and jitter
    - [x] Sub-task: Implement `Tower` component to generate the stack
- [~] Task: Conductor - User Manual Verification 'Phase 2.2: The Tower Generator' (Protocol in workflow.md)

## Phase 2.3: Hand-Physics Interaction
- [ ] Task: Upgrade Hand to Kinematic Body
    - [ ] Sub-task: Write Tests: Verify Hand component renders physics colliders (KinematicPosition)
    - [ ] Sub-task: Update `Hand.tsx` to wrap joint meshes in `RigidBody` type="kinematicPosition"
    - [ ] Sub-task: Ensure physics positions update in `useFrame` sync with visual positions
- [ ] Task: Conductor - User Manual Verification 'Phase 2.3: Hand-Physics Interaction' (Protocol in workflow.md)
