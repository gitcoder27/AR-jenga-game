import { render } from '@testing-library/react'
import Tower from './Tower'
import { describe, it, expect, vi } from 'vitest'

// Mock Block to just be a placeholder
vi.mock('./Block', () => ({
    default: ({ position, rotation }: any) => (
        <div 
            data-testid="block" 
            data-position={position.join(',')}
            data-rotation={rotation.join(',')}
        />
    ),
}))

// Mock Drei components including Instances
vi.mock('@react-three/drei', () => ({
    Instances: ({ children }: any) => <div data-testid="instances">{children}</div>,
    Instance: () => <div data-testid="instance" />,
    RoundedBox: () => <div data-testid="rounded-box-def" />,
}))

// Mock WoodMaterial
vi.mock('./materials/WoodMaterial', () => ({
    WoodMaterial: () => <div data-testid="wood-material" />
}))

describe('Tower', () => {
    it('renders 54 blocks inside an Instances group', () => {
        const { getByTestId, getAllByTestId } = render(<Tower />)
        
        // Verify Instances wrapper exists
        expect(getByTestId('instances')).toBeInTheDocument()
        
        // Verify 54 blocks are still rendered (they are children of Instances)
        const blocks = getAllByTestId('block')
        expect(blocks).toHaveLength(54)
    })
})
