import { render } from '@testing-library/react'
import Floor from './Floor'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@react-three/rapier', () => ({
    RigidBody: ({ children, type, friction, restitution, name }: any) => (
        <div 
            data-testid="floor-rb" 
            data-type={type} 
            data-friction={friction} 
            data-restitution={restitution}
            data-name={name}
        >
            {children}
        </div>
    ),
}))

describe('Floor', () => {
    it('renders a fixed rigid body with high friction and name floor', () => {
        const { getByTestId } = render(<Floor />)
        const rb = getByTestId('floor-rb')
        expect(rb).toHaveAttribute('data-type', 'fixed')
        expect(rb).toHaveAttribute('data-friction', '1')
        expect(rb).toHaveAttribute('data-name', 'floor')
    })
})
