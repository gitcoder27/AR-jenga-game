import { render } from '@testing-library/react'
import Table from './Table'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@react-three/rapier', () => ({
    RigidBody: ({ children, type, name }: any) => (
        <div data-testid="table-rb" data-type={type} data-name={name}>
            {children}
        </div>
    ),
}))

describe('Table', () => {
    it('renders a fixed rigid body named table', () => {
        const { getByTestId } = render(<Table />)
        const rb = getByTestId('table-rb')
        expect(rb).toHaveAttribute('data-type', 'fixed')
        expect(rb).toHaveAttribute('data-name', 'table')
    })
})
