import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import * as useGestureHook from '../hooks/useGesture'
import * as rapier from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import Hand from './Hand'

vi.mock('@react-three/fiber', () => ({
    useFrame: vi.fn(),
    useThree: vi.fn(() => ({
        camera: {
            position: { x: 0, y: 10, z: 20 },
            quaternion: { x: 0, y: 0, z: 0, w: 1 },
        }
    })),
    extend: vi.fn(),
}))


vi.mock('@react-three/rapier', async (importOriginal) => {
    const actual = await importOriginal() as any
    const React = await import('react')
    return {
        ...actual,
        RigidBody: React.forwardRef(({ children, type }: any, ref: any) => {
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

// The cursor's frame callback needs real three.js objects; it has its own test.
vi.mock('./DepthCursor', () => ({
    DepthCursor: () => null,
}))

vi.mock('../hooks/useGesture', () => ({
    default: vi.fn()
}))



describe('Hand Component', () => {
    const mockWorld = {
        intersectionWithShape: vi.fn(),
        intersectionsWithShape: vi.fn(),
        createImpulseJoint: vi.fn(),
        removeImpulseJoint: vi.fn(),
    }
    const mockRapier = {
        Ball: vi.fn(),
        JointData: {
            fixed: vi.fn().mockReturnValue({}),
        },
        QueryFilterFlags: { ONLY_DYNAMIC: 3 },
    }

    beforeEach(() => {
        vi.mocked(useGestureHook.default).mockReturnValue({
            isPinching: false,
            isOpenPalm: false,
            isClosedFist: false,
            gestureState: 'IDLE',
            confidence: 0,
            pinchPoint: null,
            metrics: null,
        })
        vi.mocked(rapier.useRapier).mockReturnValue({ world: mockWorld, rapier: mockRapier } as any)

        mockWorld.intersectionWithShape.mockClear()
        mockWorld.intersectionsWithShape.mockClear()
        mockWorld.createImpulseJoint.mockClear()
        mockWorld.removeImpulseJoint.mockClear()
        mockRapier.Ball.mockClear()
        mockRapier.JointData.fixed.mockClear()
    })

    // ...

    it('attempts to find a block when pinching starts', () => {
        vi.mocked(useGestureHook.default).mockReturnValue({
            isPinching: true,
            isOpenPalm: false,
            isClosedFist: false,
            gestureState: 'PINCHING',
            confidence: 0.9,
            pinchPoint: { x: 0, y: 0, z: 0 },
            metrics: { pinchDistance: 0.03, avgFingerExtension: 0.3, fingerSpread: 0.1, allFingersExtended: false, thumbExtended: false },
        })

        const result = { landmarks: [Array(21).fill({ x: 0, y: 0, z: 0 })] } as any
        render(<Hand result={result} />)

        const useFrameMock = vi.mocked(useFrame)

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

        // Execute all frame callbacks (from HandBones and UpdateLogic)
        useFrameMock.mock.calls.forEach(call => {
            const callback = call[0]
            callback({} as any, 0)
        })

        expect(mockWorld.intersectionsWithShape).toHaveBeenCalled()
        expect(mockWorld.createImpulseJoint).toHaveBeenCalled()
    })
})