import { render, screen, fireEvent } from '@testing-library/react'
import App from './App'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useGameStore, type GameStore } from './store/gameStore'
import type { ReactNode } from 'react'
import { storeWith } from './test/mockStore'

// Mock components
vi.mock('./components/Webcam', () => ({
    default: () => <div>Webcam Mock</div>
}))
vi.mock('./components/Hand', () => ({
    default: () => <div>Hand Mock</div>
}))
vi.mock('./components/Floor', () => ({
    default: () => <div>Floor Mock</div>
}))
vi.mock('./components/Table', () => ({
    default: () => <div>Table Mock</div>
}))
vi.mock('./components/Tower', () => ({
    default: () => <div>Tower Mock</div>
}))
vi.mock('./hooks/useHandTracking', () => ({
    default: () => ({ detect: vi.fn(), isReady: true })
}))

// Mock Game Store
vi.mock('./store/gameStore', () => ({
    useGameStore: vi.fn()
}))

// Mock R3F
vi.mock('@react-three/fiber', () => ({
    Canvas: ({ children }: { children?: ReactNode }) => <div data-testid="canvas">{children}</div>,
    useFrame: vi.fn(),
    extend: vi.fn(),
}))

// Mock Drei
vi.mock('@react-three/drei', () => ({
    OrbitControls: () => <div>OrbitControls</div>,
}))

// Mock Rapier
vi.mock('@react-three/rapier', () => ({
    Physics: ({ children, gravity }: { children?: ReactNode; gravity?: number[] }) => (
        <div data-testid="physics" data-gravity={JSON.stringify(gravity)}>
            {children}
        </div>
    ),
    useAfterPhysicsStep: vi.fn(),
}))

vi.mock('three', () => {
    return {
        Color: class { },
        AmbientLight: class { },
        PointLight: class { },
        GridHelper: class { },
    }
})

// Mock new components
vi.mock('./components/Lighting', () => ({
    Lighting: () => <div data-testid="lighting">Lighting Mock</div>
}))
vi.mock('./components/EnvironmentSetup', () => ({
    EnvironmentSetup: () => <div data-testid="environment-setup">EnvironmentSetup Mock</div>
}))
vi.mock('./components/StudioRoom', () => ({
    StudioRoom: () => <div data-testid="studio-room">StudioRoom Mock</div>
}))

vi.mock('./components/GameRules', () => ({
    default: () => null,
}))

vi.mock('./components/CameraControls', () => ({
    default: () => <div data-testid="camera-controls" />
}))

vi.mock('./components/DepthGauge', () => ({
    DepthGauge: () => null,
    DepthGaugeSync: () => null,
}))

describe('App', () => {
    const mockResetGame = vi.fn()
    const mockUseGameStore = vi.mocked(useGameStore)

    const defaultState: Partial<GameStore> = {
        gameState: 'PLAYING',
        gameMode: 'MENU',
        score: 0,
        resetGame: mockResetGame,
        returnToMenu: vi.fn(),
        startGame: vi.fn(),
        isWebcamVisible: false,
        isInstructionsVisible: false,
        setWebcamVisible: vi.fn(),
        setInstructionsVisible: vi.fn(),
        gameId: 0,
    }

    beforeEach(() => {
        // Default mock behavior
        mockUseGameStore.mockImplementation(storeWith(defaultState))
        mockResetGame.mockClear()
    })

    it('renders fixed header on start screen', () => {
        render(<App />)
        expect(screen.getByText('ROBOTIC JENGA')).toBeInTheDocument()
        expect(screen.getByText('CLASSIC MODE')).toBeInTheDocument()
    })

    it('renders environment components in game mode', () => {
        mockUseGameStore.mockImplementation(storeWith({ ...defaultState, gameMode: 'CLASSIC' }))
        render(<App />)
        expect(screen.getByTestId('lighting')).toBeInTheDocument()
        expect(screen.getByTestId('environment-setup')).toBeInTheDocument()
        expect(screen.getByTestId('studio-room')).toBeInTheDocument()
    })

    it('wraps scene in Physics with correct gravity in game mode', () => {
        mockUseGameStore.mockImplementation(storeWith({ ...defaultState, gameMode: 'CLASSIC' }))
        render(<App />)
        const physics = screen.getByTestId('physics')
        expect(physics).toBeInTheDocument()
        expect(physics).toHaveAttribute('data-gravity', JSON.stringify([0, -9.81, 0]))
    })

    it('shows game over overlay when game is over', () => {
        mockUseGameStore.mockImplementation(storeWith({ ...defaultState, gameState: 'GAME_OVER', gameMode: 'CLASSIC' }))

        render(<App />)
        expect(screen.getByText('TOWER COLLAPSED')).toBeInTheDocument()
        expect(screen.getByText('RE-INITIALIZE')).toBeInTheDocument()
    })

    it('resets game when reset button clicked', () => {
        mockUseGameStore.mockImplementation(storeWith({ ...defaultState, gameState: 'GAME_OVER', gameMode: 'CLASSIC' }))

        render(<App />)
        const btn = screen.getByText('RE-INITIALIZE')
        fireEvent.click(btn)
        expect(mockResetGame).toHaveBeenCalled()
    })
})