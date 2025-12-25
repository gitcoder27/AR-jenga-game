import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import * as useGestureHook from '../hooks/useGesture'

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

vi.mock('../hooks/useGesture', () => ({
    default: vi.fn()
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
  beforeEach(() => {
      vi.mocked(useGestureHook.default).mockReturnValue({ isPinching: false })
  })

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
    
    const rbs = getAllByTestId('hand-rb')
    expect(rbs.length).toBe(21)
    expect(rbs[0]).toHaveAttribute('data-type', 'kinematicPosition')
  })

  it('renders hotpink color by default', () => {
      const result = { landmarks: [Array(21).fill({x:0, y:0, z:0})] } as any
      const { container } = render(<Hand result={result} />)
      
      const material = container.querySelector('meshStandardMaterial')
      expect(material).toHaveAttribute('color', 'hotpink')
  })

  it('renders blue color when pinching', () => {
      vi.mocked(useGestureHook.default).mockReturnValue({ isPinching: true })
      
      const result = { landmarks: [Array(21).fill({x:0, y:0, z:0})] } as any
      const { container } = render(<Hand result={result} />)
      
      const material = container.querySelector('meshStandardMaterial')
      expect(material).toHaveAttribute('color', 'blue')
  })
})
