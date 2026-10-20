import { render } from '@testing-library/react'
import Floor from './Floor'
import { FLOOR_FRICTION } from '../game/config'
import { describe, it, expect, vi } from 'vitest'
import type { MockProps } from '../test/mockProps'

vi.mock('@react-three/rapier', () => ({
    RigidBody: ({ children, type, friction, restitution, name }: MockProps) => (
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
    it('renders a fixed rigid body with the table friction and name floor', () => {
        const { getByTestId } = render(<Floor />)
        const rb = getByTestId('floor-rb')
        expect(rb).toHaveAttribute('data-type', 'fixed')
        expect(rb).toHaveAttribute('data-friction', String(FLOOR_FRICTION))
        expect(rb).toHaveAttribute('data-name', 'floor')
    })
})
