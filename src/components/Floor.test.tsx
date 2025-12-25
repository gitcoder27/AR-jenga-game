import { render } from '@testing-library/react'
import Floor from './Floor'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@react-three/rapier', () => ({
    RigidBody: ({ children, type, friction }: any) => (
        <div data-testid="rigidbody" data-type={type} data-friction={friction}>
            {children}
        </div>
    ),
}))

describe('Floor', () => {
    it('renders a fixed rigid body with high friction', () => {
        const { getByTestId } = render(<Floor />)
        const rb = getByTestId('rigidbody')
        expect(rb).toHaveAttribute('data-type', 'fixed')
        // We assume friction is passed as prop for this test
        expect(rb).toHaveAttribute('data-friction', '1') // High friction
    })
})
