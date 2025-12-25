import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import * as useGestureHook from '../hooks/useGesture'
import * as rapier from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import Hand from './Hand'

vi.mock('@react-three/fiber', () => ({
    useFrame: vi.fn(),
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

vi.mock('../hooks/useGesture', () => ({
    default: vi.fn()
}))



describe('Hand Component', () => {
  const mockWorld = {
      intersectionWithShape: vi.fn(),
      createImpulseJoint: vi.fn(),
      removeImpulseJoint: vi.fn(),
  }
  const mockRapier = {
      Ball: vi.fn(),
      JointData: {
          fixed: vi.fn().mockReturnValue({}),
      },
  }

  beforeEach(() => {
      vi.mocked(useGestureHook.default).mockReturnValue({ isPinching: false })
      vi.mocked(rapier.useRapier).mockReturnValue({ world: mockWorld, rapier: mockRapier } as any)
      
      mockWorld.intersectionWithShape.mockClear()
      mockWorld.createImpulseJoint.mockClear()
      mockWorld.removeImpulseJoint.mockClear()
      mockRapier.Ball.mockClear()
      mockRapier.JointData.fixed.mockClear()
  })

  // ...

  it('attempts to find a block when pinching starts', () => {
      vi.mocked(useGestureHook.default).mockReturnValue({ isPinching: true })
      
      const result = { landmarks: [Array(21).fill({x:0, y:0, z:0})] } as any
      render(<Hand result={result} />)
      
      const useFrameMock = vi.mocked(useFrame)
      const callback = useFrameMock.mock.calls[0][0]
      
      // Mock intersection to return a hit
      const mockBody = {
          isDynamic: vi.fn().mockReturnValue(true),
          wakeUp: vi.fn(),
          linearDamping: vi.fn().mockReturnValue(0),
          angularDamping: vi.fn().mockReturnValue(0),
          setLinearDamping: vi.fn(),
          setAngularDamping: vi.fn(),
          translation: vi.fn().mockReturnValue({x:0, y:0, z:0}),
          rotation: vi.fn().mockReturnValue({x:0, y:0, z:0, w:1}),
      }
      const mockCollider = {
          parent: vi.fn().mockReturnValue(mockBody),
      }
      
      mockWorld.intersectionWithShape.mockReturnValue(mockCollider)
      
      // Execute the frame callback
      callback()
      
      expect(mockWorld.intersectionWithShape).toHaveBeenCalled()
      expect(mockRapier.Ball).toHaveBeenCalledWith(0.5)
      expect(mockWorld.createImpulseJoint).toHaveBeenCalled()
  })
})