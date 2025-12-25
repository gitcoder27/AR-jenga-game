import { render } from '@testing-library/react'
import Tower from './Tower'
import { describe, it, expect, vi } from 'vitest'

vi.mock('./Block', () => ({
    default: ({ position, rotation }: any) => (
        <div 
            data-testid="block" 
            data-position={position.join(',')}
            data-rotation={rotation.join(',')}
        />
    ),
}))

describe('Tower', () => {
    it('renders 54 blocks', () => {
        const { getAllByTestId } = render(<Tower />)
        const blocks = getAllByTestId('block')
        expect(blocks).toHaveLength(54)
    })
})
