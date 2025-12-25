import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HUD } from './HUD';

// Mock store
const mockReturnToMenu = vi.fn();

vi.mock('../../store/gameStore', () => ({
  useGameStore: (selector?: any) => {
    const state = {
      score: 10,
      gameState: 'PLAYING',
      gameMode: 'CLASSIC',
      isWebcamVisible: false,
      isInstructionsVisible: true,
      setWebcamVisible: vi.fn(),
      setInstructionsVisible: vi.fn(),
      resetGame: vi.fn(),
      returnToMenu: mockReturnToMenu,
    };
    return selector ? selector(state) : state;
  }
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

  it('renders EXIT GAME button and calls returnToMenu on click', () => {
    const { getByText } = render(<HUD />);
    const exitBtn = getByText('EXIT GAME');
    expect(exitBtn).toBeInTheDocument();
    exitBtn.click();
    expect(mockReturnToMenu).toHaveBeenCalled();
  });
});
