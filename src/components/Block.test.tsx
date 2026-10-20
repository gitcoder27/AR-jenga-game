import { render, fireEvent } from '@testing-library/react'
import Block from './Block'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSetGameState = vi.fn()
let mockHeldBlockId: string | null = null
let mockMovingBlockId: string | null = null

vi.mock('../store/gameStore', () => ({
    useGameStore: (selector: any) => selector({
        setGameState: mockSetGameState,
        heldBlockId: mockHeldBlockId,
        movingBlockId: mockMovingBlockId,
        hoveredBlockId: null,
        gameState: 'PLAYING',
        gameMode: 'CLASSIC',
    }),
}))

vi.mock('@react-three/fiber', () => ({
    useFrame: vi.fn(),
}))

vi.mock('@react-three/rapier', () => ({
    RigidBody: ({ children, type, mass, friction, restitution, onCollisionEnter, name, canSleep }: any) => (
        <div
            data-testid="block-rb"
            data-type={type}
            data-mass={mass}
            data-friction={friction}
            data-restitution={restitution}
            data-name={name}
            data-can-sleep={canSleep}
            onClick={() => onCollisionEnter && onCollisionEnter({ other: { rigidBodyObject: { name: 'floor' } } })}
        >
            {children}
        </div>
    ),
    CuboidCollider: ({ args }: any) => <div data-testid="cuboid-collider" data-args={JSON.stringify(args)} />,
}))

vi.mock('@react-three/drei', () => ({
    Instance: ({ color }: any) => (
        <div data-testid="block-instance" data-color={color ? 'has-color' : 'no-color'} />
    )
}))

describe('Block', () => {
    beforeEach(() => {
        mockSetGameState.mockClear()
        mockHeldBlockId = null
        mockMovingBlockId = null
    })

    it('renders a dynamic rigid body with correct properties', () => {
        const { getByTestId } = render(<Block id="test-block" position={[0, 0, 0]} rotation={[0, 0, 0]} />)
        const rb = getByTestId('block-rb')
        expect(rb).toHaveAttribute('data-type', 'dynamic')
        expect(rb).toHaveAttribute('data-mass', '2')
        expect(rb).toHaveAttribute('data-friction', '1')
        expect(rb).toHaveAttribute('data-restitution', '0')
        expect(rb).toHaveAttribute('data-can-sleep', 'true')

        const collider = getByTestId('cuboid-collider')
        expect(collider).toBeInTheDocument()
        expect(collider).toHaveAttribute('data-args', JSON.stringify([1.25, 0.75, 3.75]))

        const instance = getByTestId('block-instance')
        expect(instance).toBeInTheDocument()
    })

    it('triggers GAME_OVER when colliding with floor if not safe', () => {
        const { getByTestId } = render(<Block id="test-block" position={[0, 0, 0]} rotation={[0, 0, 0]} />)
        const rb = getByTestId('block-rb')

        fireEvent.click(rb)

        expect(mockSetGameState).toHaveBeenCalledWith('GAME_OVER')
    })

    it('does NOT trigger GAME_OVER for the block being moved this turn, even after release', () => {
        // Grabbed, then dropped: no longer held, but still the block moved this turn
        mockMovingBlockId = 'test-block'
        const { getByTestId } = render(<Block id="test-block" position={[0, 0, 0]} rotation={[0, 0, 0]} />)

        fireEvent.click(getByTestId('block-rb'))

        expect(mockSetGameState).not.toHaveBeenCalled()
    })

    it('triggers GAME_OVER for a block that was moved in an earlier turn', () => {
        // Previously handled, but another block is being moved now
        mockMovingBlockId = 'other-block'
        const { getByTestId } = render(<Block id="test-block" position={[0, 0, 0]} rotation={[0, 0, 0]} />)

        fireEvent.click(getByTestId('block-rb'))

        expect(mockSetGameState).toHaveBeenCalledWith('GAME_OVER')
    })
})