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

const mockSetInstructionsVisible = vi.fn();
const mockSetTutorialStep = vi.fn();
const mockEndTutorial = vi.fn();
const mockStartTutorial = vi.fn();

vi.mock('../../store/gameStore', () => ({
  useGameStore: Object.assign((selector?: MockSelector) => {
    const state = {
      score: 10,
      gameState: 'PLAYING',
      gameMode: 'CLASSIC',
      isWebcamVisible: false,
      isInstructionsVisible: true,
      setWebcamVisible: vi.fn(),
      setInstructionsVisible: mockSetInstructionsVisible,
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
      tutorialStep: null,
      setTutorialStep: mockSetTutorialStep,
      endTutorial: mockEndTutorial,
      startTutorial: mockStartTutorial,
      ...overrides,
    };
    return selector ? selector(state) : state;
  }, { subscribe: () => () => {} })
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

  it('renders EXIT GAME button and calls returnToMenu on click (Sandbox: no confirmation, O-6)', () => {
    overrides = { gameMode: 'SANDBOX' };
    const { getByText } = render(<HUD />);
    overrides = {};
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

  describe('leaving a game [O-6]', () => {
    it('asks before leaving a Classic game in play; KEEP PLAYING stays, LEAVE goes', () => {
      overrides = {};
      mockReturnToMenu.mockClear();
      render(<HUD />);
      fireEvent.click(screen.getByText('EXIT GAME'));
      expect(mockReturnToMenu).not.toHaveBeenCalled();
      expect(screen.getByRole('alertdialog', { name: /leave this game/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'KEEP PLAYING' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      // The title asks too
      fireEvent.click(screen.getByText('ROBOTIC JENGA'));
      fireEvent.click(screen.getByRole('button', { name: 'LEAVE' }));
      expect(mockReturnToMenu).toHaveBeenCalledTimes(1);
    });

    it('Escape keeps playing', () => {
      overrides = {};
      render(<HUD />);
      fireEvent.click(screen.getByText('EXIT GAME'));
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('leaves Sandbox, or a finished game, at once', () => {
      overrides = { gameMode: 'SANDBOX' };
      mockReturnToMenu.mockClear();
      const { unmount } = render(<HUD />);
      fireEvent.click(screen.getByText('EXIT GAME'));
      expect(mockReturnToMenu).toHaveBeenCalledTimes(1);
      unmount();
      overrides = { gameState: 'GAME_OVER' };
      render(<HUD />);
      fireEvent.click(screen.getByText('EXIT GAME'));
      expect(mockReturnToMenu).toHaveBeenCalledTimes(2);
      overrides = {};
    });
  });

  describe('tutorial [O-1]', () => {
    it('shows the step in the hint slot; the calibrate step can be skipped, and the whole tutorial', () => {
      overrides = { tutorialStep: 'calibrate', isInstructionsVisible: false };
      render(<HUD />);
      overrides = {};
      const card = screen.getByRole('region', { name: 'Tutorial' });
      expect(card).toHaveTextContent('STEP 2 OF 6');
      expect(card).toHaveTextContent('CALIBRATE YOUR REACH');
      fireEvent.click(screen.getByRole('button', { name: 'CALIBRATE' }));
      expect(mockStartCalibration).toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'SKIP THIS STEP' }));
      expect(mockSetTutorialStep).toHaveBeenCalledWith('touch');
      fireEvent.click(screen.getByRole('button', { name: 'SKIP TUTORIAL' }));
      expect(mockEndTutorial).toHaveBeenCalled();
    });

    it('takes the place of the move hint, but not the camera-mode banner', () => {
      overrides = { tutorialStep: 'place', movePhase: 'MOVED', isCameraMode: true };
      const { rerender } = render(<HUD />);
      expect(screen.queryByRole('region', { name: 'Tutorial' })).toBeNull();
      overrides = { tutorialStep: 'place', movePhase: 'MOVED' };
      rerender(<HUD />);
      overrides = {};
      expect(screen.getByRole('region', { name: 'Tutorial' })).toHaveTextContent('PUT IT ON TOP');
      expect(screen.queryByText('PICK IT UP AND PUT IT ON TOP')).toBeNull();
    });

    it('"?" brings the hints back, and SETTINGS replays the tutorial', () => {
      render(<HUD />);
      fireEvent.click(screen.getByRole('button', { name: 'How to play' }));
      expect(mockSetInstructionsVisible).toHaveBeenCalledWith(true);
      fireEvent.click(screen.getByRole('button', { name: 'SETTINGS' }));
      fireEvent.click(screen.getByRole('button', { name: 'REPLAY TUTORIAL' }));
      expect(mockStartTutorial).toHaveBeenCalled();
    });
  });
});
