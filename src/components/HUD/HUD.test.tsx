import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HUD } from './HUD';

// Mock store
vi.mock('../../store/gameStore', () => ({
    useGameStore: () => ({
        score: 10,
        gameState: 'PLAYING',
        isWebcamVisible: false,
        isInstructionsVisible: true,
        setWebcamVisible: vi.fn(),
        setInstructionsVisible: vi.fn(),
        resetGame: vi.fn(),
    })
}));

describe('HUD', () => {
  it('renders the title and score', () => {
    render(<HUD />);
    expect(screen.getByText('ROBOTIC JENGA')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('renders instructions initially', () => {
    render(<HUD />);
    expect(screen.getByText('PINCH TO GRAB')).toBeInTheDocument();
  });
});
