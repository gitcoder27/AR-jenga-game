import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import * as useGestureHook from '../hooks/useGesture'
import * as rapier from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import Hand from './Hand'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import type { ReactNode } from 'react'

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
    }
})

// The cursor's and the ghost's frame callbacks need real three.js objects; it has its own test.
vi.mock('./DepthCursor', () => ({
    DepthCursor: () => null,
}))
vi.mock('./PlacementGhost', () => ({
    PlacementGhost: () => null,
}))

vi.mock('../hooks/useGesture', () => ({
    default: vi.fn()
}))



describe('Hand Component', () => {
    const mockWorld = {
        intersectionWithShape: vi.fn(),
        intersectionsWithShape: vi.fn(),
        castRay: vi.fn().mockReturnValue(null),
        createImpulseJoint: vi.fn(),
        removeImpulseJoint: vi.fn(),
        getRigidBody: vi.fn(),
        forEachRigidBody: vi.fn(),
    }
    const mockRapier = {
        Ball: vi.fn(),
        JointData: {
            fixed: vi.fn().mockReturnValue({}),
        },
        QueryFilterFlags: { ONLY_DYNAMIC: 3, EXCLUDE_KINEMATIC: 2 },
        Ray: vi.fn(),
    }

    beforeEach(() => {
        vi.mocked(useGestureHook.default).mockReturnValue({
            isPinching: false,
            isOpenPalm: false,
            gestureState: 'IDLE',
            confidence: 0,
            pinchPoint: null,
            metrics: null,
        })
        vi.mocked(rapier.useRapier).mockReturnValue({ world: mockWorld, rapier: mockRapier } as unknown as ReturnType<typeof rapier.useRapier>)

        mockWorld.intersectionWithShape.mockClear()
        mockWorld.intersectionsWithShape.mockClear()
        mockWorld.createImpulseJoint.mockClear()
        mockWorld.removeImpulseJoint.mockClear()
        mockRapier.Ball.mockClear()
        mockRapier.JointData.fixed.mockClear()
    })



    it('grabs the block under the pinch when the pinch closes', () => {
        const openHand = {
            isPinching: false,
            isOpenPalm: false,
            gestureState: 'IDLE' as const,
            confidence: 0,
            pinchPoint: null,
            metrics: null,
        }
        const result = { landmarks: [Array(21).fill({ x: 0, y: 0, z: 0 })] } as unknown as HandLandmarkerResult
        const useFrameMock = vi.mocked(useFrame)
        const runFrame = () => useFrameMock.mock.calls.at(-1)![0]({} as never, 1 / 60)

        // Open hand first: a pinch only grabs as it closes (G-4)
        vi.mocked(useGestureHook.default).mockReturnValue(openHand)
        const { rerender } = render(<Hand result={result} />)

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
            userData: { blockId: '2-0' },
        }
        const mockCollider = {
            parent: vi.fn().mockReturnValue(mockBody),
            projectPoint: vi.fn().mockReturnValue({ isInside: false, point: { x: 0.2, y: 0, z: 0 } }),
        }

        mockWorld.intersectionsWithShape.mockImplementation((_pos, _rot, _shape, callback) => callback(mockCollider))

        runFrame()
        expect(mockWorld.createImpulseJoint).not.toHaveBeenCalled()

        vi.mocked(useGestureHook.default).mockReturnValue({
            ...openHand,
            isPinching: true,
            gestureState: 'PINCHING',
            confidence: 0.9,
        })
        rerender(<Hand result={result} />)
        runFrame()

        expect(mockWorld.intersectionsWithShape).toHaveBeenCalled()
        expect(mockWorld.createImpulseJoint).toHaveBeenCalled()
    })
})