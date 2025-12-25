import { render, screen } from '@testing-library/react'
import App from './App'
import { describe, it, expect, vi } from 'vitest'

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
vi.mock('./hooks/useHandTracking', () => ({
    default: () => ({ detect: vi.fn(), isReady: true })
}))

// Mock R3F
vi.mock('@react-three/fiber', () => ({
    Canvas: ({ children }: any) => <div data-testid="canvas">{children}</div>,
    useFrame: vi.fn(),
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

describe('App', () => {
  it('renders the title', () => {
    render(<App />)
    expect(screen.getByText('Virtual Hand Jenga')).toBeInTheDocument()
  })

  it('wraps scene in Physics with correct gravity', () => {
    render(<App />)
    const physics = screen.getByTestId('physics')
    expect(physics).toBeInTheDocument()
    expect(physics).toHaveAttribute('data-gravity', JSON.stringify([0, -9.81, 0]))
  })
})