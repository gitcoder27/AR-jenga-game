import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HUD } from './HUD';
import type { MockSelector } from '../../test/mockProps';

// Mock store
const mockReturnToMenu = vi.fn();
const mockToggleCameraMode = vi.fn();
let overrides: Record<string, unknown> = {};

vi.mock('../../store/gameStore', () => ({
  useGameStore: (selector?: MockSelector) => {
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
      isCameraMode: false,
      heldBlockId: null,
      toggleCameraMode: mockToggleCameraMode,
      ...overrides,
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
    expect(screen.getByText('PINCH THUMB + INDEX TO GRAB')).toBeInTheDocument();
  });

  it('renders EXIT GAME button and calls returnToMenu on click', () => {
    const { getByText } = render(<HUD />);
    const exitBtn = getByText('EXIT GAME');
    expect(exitBtn).toBeInTheDocument();
    exitBtn.click();
    expect(mockReturnToMenu).toHaveBeenCalled();
  });

  describe('camera mode [H-2]', () => {
    it('the TURN VIEW button and the C key toggle it', () => {
      overrides = {};
      mockToggleCameraMode.mockClear();
      render(<HUD />);
      screen.getByRole('button', { name: /turn view/i }).click();
      fireEvent.keyDown(window, { key: 'c' });
      fireEvent.keyDown(window, { key: 'C' });
      // Not with a modifier (browser shortcuts), nor a held key's repeats
      fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
      fireEvent.keyDown(window, { key: 'c', repeat: true });
      expect(mockToggleCameraMode).toHaveBeenCalledTimes(3);
    });

    it('shows a banner and a pressed button while it is on', () => {
      overrides = { isCameraMode: true };
      render(<HUD />);
      expect(screen.getByText(/turning the view/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /turn view/i })).toHaveAttribute('aria-pressed', 'true');
      overrides = {};
    });

    it('is unavailable while a block is held', () => {
      overrides = { heldBlockId: '3-1' };
      render(<HUD />);
      expect(screen.getByRole('button', { name: /turn view/i })).toBeDisabled();
      overrides = {};
    });
  });
});
