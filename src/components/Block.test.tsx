import { render } from '@testing-library/react'
import Block from './Block'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@react-three/rapier', () => ({
    RigidBody: ({ children, type, mass, friction, restitution }: any) => (
        <div 
            data-testid="block-rb" 
            data-type={type} 
            data-mass={mass} 
            data-friction={friction}
            data-restitution={restitution}
        >
            {children}
        </div>
    ),
}))

describe('Block', () => {
    it('renders a dynamic rigid body with correct properties', () => {
        const { getByTestId } = render(<Block position={[0,0,0]} rotation={[0,0,0]} />)
        const rb = getByTestId('block-rb')
        expect(rb).toHaveAttribute('data-type', 'dynamic')
        expect(rb).toHaveAttribute('data-mass', '1')
        expect(rb).toHaveAttribute('data-friction', '0.8')
        expect(rb).toHaveAttribute('data-restitution', '0')
    })
})
