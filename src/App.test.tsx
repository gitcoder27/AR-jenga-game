import { render, screen, fireEvent } from '@testing-library/react'
import App from './App'
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
const mockResetGame = vi.fn()
const mockSetGameState = vi.fn()
const mockUseGameStore = vi.fn()
vi.mock('./store/gameStore', () => ({
    useGameStore: (selector: any) => mockUseGameStore(selector)
}))

// Mock R3F
vi.mock('@react-three/fiber', () => ({
    Canvas: ({ children }: any) => <div data-testid="canvas">{children}</div>,
    useFrame: vi.fn(),
    extend: vi.fn(),
}))

// Mock Drei
vi.mock('@react-three/drei', () => ({
    OrbitControls: () => <div>OrbitControls</div>,
}))

// Mock Rapier
vi.mock('@react-three/rapier', () => ({
    Physics: ({ children, gravity }: any) => (
        <div data-testid="physics" data-gravity={JSON.stringify(gravity)}>
            {children}
        </div>
    ),
}))

vi.mock('three', () => {
    return {
        Color: class {},
        AmbientLight: class {},
        PointLight: class {},
        GridHelper: class {},
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
vi.mock('./components/DepthCursor', () => ({
    DepthCursor: () => <div data-testid="depth-cursor">DepthCursor Mock</div>
}))

describe('App', () => {
  beforeEach(() => {
      // Default mock behavior
      mockUseGameStore.mockImplementation((selector: any) => selector({
          gameState: 'PLAYING',
          resetGame: mockResetGame,
      }))
      mockResetGame.mockClear()
  })

  it('renders the title', () => {
    render(<App />)
    expect(screen.getByText('Virtual Hand Jenga')).toBeInTheDocument()
  })

  it('renders environment components', () => {
    render(<App />)
    expect(screen.getByTestId('lighting')).toBeInTheDocument()
    expect(screen.getByTestId('environment-setup')).toBeInTheDocument()
    expect(screen.getByTestId('studio-room')).toBeInTheDocument()
  })

  it('wraps scene in Physics with correct gravity', () => {
    render(<App />)
    const physics = screen.getByTestId('physics')
    expect(physics).toBeInTheDocument()
    expect(physics).toHaveAttribute('data-gravity', JSON.stringify([0, -9.81, 0]))
  })

  it('shows game over overlay when game is over', () => {
      mockUseGameStore.mockImplementation((selector: any) => selector({
          gameState: 'GAME_OVER',
          resetGame: mockResetGame,
      }))

      render(<App />)
      expect(screen.getByText('Game Over')).toBeInTheDocument()
      expect(screen.getByText('Reset Game')).toBeInTheDocument()
  })

  it('resets game when reset button clicked', () => {
      mockUseGameStore.mockImplementation((selector: any) => selector({
          gameState: 'GAME_OVER',
          resetGame: mockResetGame,
      }))

      render(<App />)
      const btn = screen.getByText('Reset Game')
      fireEvent.click(btn)
      expect(mockResetGame).toHaveBeenCalled()
  })
})