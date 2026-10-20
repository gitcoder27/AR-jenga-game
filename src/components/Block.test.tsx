import { render, fireEvent } from '@testing-library/react'
import Block from './Block'
import { BLOCK_FRICTION } from '../game/config'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MockProps, MockSelector } from '../test/mockProps'

const mockSetGameState = vi.fn()
let mockHeldBlockId: string | null = null

vi.mock('../store/gameStore', () => ({
    useGameStore: (selector: MockSelector) => selector({
        setGameState: mockSetGameState,
        heldBlockId: mockHeldBlockId,
        hoveredBlockId: null,
        gameState: 'PLAYING',
        gameMode: 'CLASSIC',
    }),
}))

vi.mock('@react-three/fiber', () => ({
    useFrame: vi.fn(),
}))

vi.mock('@react-three/rapier', () => ({
    RigidBody: ({ children, type, mass, friction, restitution, onCollisionEnter, name, canSleep }: MockProps & { onCollisionEnter?: (e: unknown) => void }) => (
        <div
            data-testid="block-rb"
            data-type={type}
            data-mass={mass}
            data-friction={friction}
            data-restitution={restitution}
            data-name={name}
            data-can-sleep={canSleep}
            onClick={() => onCollisionEnter?.({ other: { rigidBodyObject: { name: 'floor' } } })}
        >
            {children}
        </div>
    ),
    CuboidCollider: ({ args }: MockProps) => <div data-testid="cuboid-collider" data-args={JSON.stringify(args)} />,
}))

vi.mock('@react-three/drei', () => ({
    Instance: ({ color }: MockProps) => (
        <div data-testid="block-instance" data-color={color ? 'has-color' : 'no-color'} />
    )
}))

describe('Block', () => {
    beforeEach(() => {
        mockSetGameState.mockClear()
        mockHeldBlockId = null
    })

    it('renders a dynamic rigid body with correct properties', () => {
        const { getByTestId } = render(<Block id="test-block" position={[0, 0, 0]} rotation={[0, 0, 0]} />)
        const rb = getByTestId('block-rb')
        expect(rb).toHaveAttribute('data-type', 'dynamic')
        expect(rb).toHaveAttribute('data-mass', '2')
        expect(rb).toHaveAttribute('data-friction', String(BLOCK_FRICTION))
        expect(rb).toHaveAttribute('data-restitution', '0')
        expect(rb).toHaveAttribute('data-can-sleep', 'true')

        const collider = getByTestId('cuboid-collider')
        expect(collider).toBeInTheDocument()
        expect(collider).toHaveAttribute('data-args', JSON.stringify([1.25, 0.75, 3.75]))

        const instance = getByTestId('block-instance')
        expect(instance).toBeInTheDocument()
    })

    it('floor contact alone never ends the game: fouls are rule-based (C-4, see game/moves.ts)', () => {
        const { getByTestId } = render(<Block id="test-block" position={[0, 0, 0]} rotation={[0, 0, 0]} />)
        fireEvent.click(getByTestId('block-rb'))
        expect(mockSetGameState).not.toHaveBeenCalled()
    })
})