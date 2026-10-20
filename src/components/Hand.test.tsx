import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import * as rapier from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import Hand from './Hand'
import type { HandGesture, TrackedHand } from '../tracking/handTracker'
import type { ReactNode } from 'react'
import { CameraClutch } from '../tracking/cameraClutch'

vi.mock('@react-three/fiber', async () => {
    const { PerspectiveCamera } = await import('three')
    const camera = new PerspectiveCamera(50, 16 / 9)
    camera.position.set(0, 14, 40)
    const state = { camera }
    return {
        useFrame: vi.fn(),
        useThree: vi.fn((selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state)),
        extend: vi.fn(),
    }
})


vi.mock('@react-three/rapier', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@react-three/rapier')>()
    const React = await import('react')
    return {
        ...actual,
        RigidBody: React.forwardRef<unknown, { children?: ReactNode; type?: string }>(({ children, type }, ref) => {
            React.useImperativeHandle(ref, () => ({
                translation: () => ({ x: 0, y: 0, z: 0 }),
                rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
                setNextKinematicTranslation: vi.fn(),
                setTranslation: vi.fn(),
                numColliders: () => 0,
            }))
            return (
                <div data-testid="hand-rb" data-type={type}>
                    {children}
                </div>
            )
        }),
        useRapier: vi.fn(),
        useFixedJoint: vi.fn(),
        useBeforePhysicsStep: vi.fn(),
    }
})

// The cursor's and the ghost's frame callbacks need real three.js objects; it has its own test.
vi.mock('./DepthCursor', () => ({
    DepthCursor: () => null,
}))
vi.mock('./PlacementGhost', () => ({
    PlacementGhost: () => null,
}))




describe('Hand Component', () => {
    const mockWorld = {
        intersectionWithShape: vi.fn(),
        intersectionsWithShape: vi.fn(),
        castRay: vi.fn().mockReturnValue(null),
        createImpulseJoint: vi.fn().mockReturnValue({ setContactsEnabled: vi.fn() }),
        removeImpulseJoint: vi.fn(),
        // The soft grab's proxy body (G-1)
        createRigidBody: vi.fn().mockReturnValue({
            handle: 99,
            setEnabled: vi.fn(),
            setTranslation: vi.fn(),
            setLinvel: vi.fn(),
            setRotation: vi.fn(),
            translation: () => ({ x: 0, y: 0, z: 0 }),
            rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
        }),
        createCollider: vi.fn().mockReturnValue({ setSolverGroups: vi.fn(), shape: {} }),
        removeRigidBody: vi.fn(),
        getRigidBody: vi.fn(),
        forEachRigidBody: vi.fn(),
    }
    const proxyDesc = {
        setTranslation: () => proxyDesc,
        setRotation: () => proxyDesc,
        setGravityScale: () => proxyDesc,
        setCanSleep: () => proxyDesc,
        setAdditionalMassProperties: () => proxyDesc,
        // The fingertip (G-3)
        setCcdEnabled: () => proxyDesc,
        lockRotations: () => proxyDesc,
        setAdditionalMass: () => proxyDesc,
        setEnabled: () => proxyDesc,
    }
    const colliderDesc = {
        setDensity: () => colliderDesc,
        setFriction: () => colliderDesc,
        setSolverGroups: () => colliderDesc,
    }
    const mockRapier = {
        Ball: vi.fn(),
        RigidBodyDesc: { dynamic: () => proxyDesc },
        ColliderDesc: { capsule: () => colliderDesc },
        Capsule: vi.fn(),
        JointData: {
            fixed: vi.fn().mockReturnValue({}),
        },
        QueryFilterFlags: { ONLY_DYNAMIC: 3, EXCLUDE_KINEMATIC: 2 },
        Ray: vi.fn(),
    }

    beforeEach(() => {
        vi.mocked(rapier.useRapier).mockReturnValue({ world: mockWorld, rapier: mockRapier } as unknown as ReturnType<typeof rapier.useRapier>)

        mockWorld.intersectionWithShape.mockClear()
        mockWorld.intersectionsWithShape.mockClear()
        mockWorld.createImpulseJoint.mockClear()
        mockWorld.removeImpulseJoint.mockClear()
        mockRapier.Ball.mockClear()
        mockRapier.JointData.fixed.mockClear()
    })



    it('grabs the block under the pinch when the pinch closes', () => {
        const open: HandGesture = { state: 'IDLE', isPinching: false, isOpenPalm: false, isClosing: false, confidence: 0 }
        const handWith = (gesture: HandGesture): TrackedHand => ({ landmarks: Array(21).fill({ x: 0.5, y: 0.5, z: 0 }), gesture, depth: 0, timestamp: 0 })
        const useFrameMock = vi.mocked(useFrame)
        const runFrame = () => useFrameMock.mock.calls.at(-1)![0]({} as never, 1 / 60)

        // Open hand first: a pinch only grabs as it closes (G-4)
        const handRef: { current: TrackedHand | null } = { current: handWith(open) }
        render(<Hand handRef={handRef} clutch={new CameraClutch()} />)

        // Mock intersection to return a hit
        const mockBody = {
            isDynamic: vi.fn().mockReturnValue(true),
            wakeUp: vi.fn(),
            linearDamping: vi.fn().mockReturnValue(0),
            angularDamping: vi.fn().mockReturnValue(0),
            setLinearDamping: vi.fn(),
            setAngularDamping: vi.fn(),
            translation: vi.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
            rotation: vi.fn().mockReturnValue({ x: 0, y: 0, z: 0, w: 1 }),
            mass: vi.fn().mockReturnValue(1),
            userData: { blockId: '2-0' },
        }
        const mockCollider = {
            parent: vi.fn().mockReturnValue(mockBody),
            // The pinch point is inside the block
            projectPoint: vi.fn().mockReturnValue({ isInside: true, point: { x: 0, y: 0, z: 0 } }),
        }

        mockWorld.intersectionsWithShape.mockImplementation((_pos, _rot, _shape, callback) => callback(mockCollider))

        runFrame()
        expect(mockWorld.createImpulseJoint).not.toHaveBeenCalled()

        // No re-render: the hand is read from the ref every frame (M-1)
        handRef.current = handWith({ ...open, state: 'PINCHING', isPinching: true, confidence: 0.9 })
        runFrame()

        expect(mockWorld.intersectionsWithShape).toHaveBeenCalled()
        expect(mockWorld.createImpulseJoint).toHaveBeenCalled()
    })
})