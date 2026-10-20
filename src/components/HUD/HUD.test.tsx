import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HUD } from './HUD';
import type { MockSelector } from '../../test/mockProps';

// Mock store
const mockReturnToMenu = vi.fn();
const mockToggleCameraMode = vi.fn();
const mockSetReachIn = vi.fn();
const mockStartCalibration = vi.fn();
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
      depthSettings: { calibration: null, reachIn: false },
      calibrationStatus: 'idle',
      setReachIn: mockSetReachIn,
      startCalibration: mockStartCalibration,
      clearCalibration: vi.fn(),
      setCalibrationStatus: vi.fn(),
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

  describe('depth [H-3, H-4]', () => {
    it('the SETTINGS panel sets the depth direction and starts calibration', () => {
      overrides = {};
      render(<HUD />);
      fireEvent.click(screen.getByRole('button', { name: 'SETTINGS' }));
      expect(screen.getByRole('dialog', { name: /settings/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'TOWARD YOU' })).toHaveAttribute('aria-pressed', 'true');
      screen.getByRole('button', { name: 'INTO THE SCENE' }).click();
      expect(mockSetReachIn).toHaveBeenCalledWith(true);
      screen.getByRole('button', { name: /calibrate/i }).click();
      expect(mockStartCalibration).toHaveBeenCalled();
    });

    it('the instructions follow the depth direction', () => {
      overrides = { depthSettings: { calibration: null, reachIn: true } };
      render(<HUD />);
      expect(screen.getByText(/deeper into the scene/i)).toBeInTheDocument();
      overrides = {};
    });

    it('prompts each calibration step, and says why one failed', () => {
      overrides = { calibrationStatus: 'far' };
      const { unmount } = render(<HUD />);
      expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument();
      expect(screen.getByText(/as far from the webcam/i)).toBeInTheDocument();
      unmount();
      overrides = { calibrationStatus: 'too-similar' };
      render(<HUD />);
      expect(screen.getByText(/too alike/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      overrides = {};
    });
  });
});
