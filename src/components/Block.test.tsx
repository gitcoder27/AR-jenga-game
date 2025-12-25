import { render } from '@testing-library/react'
import Block from './Block'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSetGameState = vi.fn()

vi.mock('../store/gameStore', () => ({
    useGameStore: (selector: any) => selector({
        setGameState: mockSetGameState,
        heldBlockId: null,
        gameState: 'PLAYING',
    }),
}))

vi.mock('@react-three/rapier', () => ({
    RigidBody: ({ children, type, mass, friction, restitution, onCollisionEnter, name, userData }: any) => (
        <div 
            data-testid="block-rb" 
            data-type={type} 
            data-mass={mass} 
            data-friction={friction}
            data-restitution={restitution}
            data-name={name}
            // Trigger collision via a prop for testing if we wanted, or capture the function
            onClick={() => onCollisionEnter && onCollisionEnter({ other: { rigidBodyObject: { name: 'floor' } } })}
        >
            {children}
        </div>
    ),
}))

describe('Block', () => {
    beforeEach(() => {
        mockSetGameState.mockClear()
    })

    it('renders a dynamic rigid body with correct properties', () => {
        const { getByTestId } = render(<Block id="test-block" position={[0,0,0]} rotation={[0,0,0]} />)
        const rb = getByTestId('block-rb')
        expect(rb).toHaveAttribute('data-type', 'dynamic')
        expect(rb).toHaveAttribute('data-mass', '1')
        expect(rb).toHaveAttribute('data-friction', '0.8')
        expect(rb).toHaveAttribute('data-restitution', '0')
    })

    it('triggers GAME_OVER when colliding with floor', () => {
        const { getByTestId } = render(<Block id="test-block" position={[0,0,0]} rotation={[0,0,0]} />)
        const rb = getByTestId('block-rb')
        
        // Simulate collision
        rb.click()
        
        expect(mockSetGameState).toHaveBeenCalledWith('GAME_OVER')
    })
})
