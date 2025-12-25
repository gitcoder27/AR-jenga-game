import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('@react-three/fiber', () => ({
    useFrame: vi.fn(),
    extend: vi.fn(),
}))

vi.mock('@react-three/rapier', () => ({
    RigidBody: ({ children, type }: any) => (
        <div data-testid="hand-rb" data-type={type}>
            {children}
        </div>
    ),
}))

vi.mock('three', () => {
    return {
        Mesh: class {},
        Vector3: class { set() {} },
        Quaternion: class { setFromEuler() {} },
        Euler: class {},
    }
})

import Hand from './Hand'

describe('Hand Component', () => {
  it('renders null when no result', () => {
    const { container } = render(<Hand result={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders null when empty landmarks', () => {
      const emptyResult = { landmarks: [], worldLandmarks: [], handedness: [] }
      const { container } = render(<Hand result={emptyResult} />)
      expect(container.firstChild).toBeNull()
  })

  it('renders kinematic rigid bodies when landmarks exist', () => {
    const result = { landmarks: [Array(21).fill({x:0, y:0, z:0})] } as any
    const { getAllByTestId } = render(<Hand result={result} />)
    
    // It should render 21 RigidBodies
    // But currently Hand.tsx renders 21 meshes directly.
    // So this test expects the implementation to be done.
    // The test is "Red" (Failing) because implementation is not there.
    // But it failed due to R3F error, not assertion error.
    // Now with R3F mocked, it should fail assertion (0 found).
    
    const rbs = getAllByTestId('hand-rb')
    expect(rbs.length).toBe(21)
    expect(rbs[0]).toHaveAttribute('data-type', 'kinematicPosition')
  })
})
