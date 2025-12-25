import { render, screen, fireEvent } from '@testing-library/react';
import StartScreen from './StartScreen';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGameStore } from '../../store/gameStore';

vi.mock('../../store/gameStore', () => ({
    useGameStore: vi.fn()
}));

describe('StartScreen', () => {
    const mockStartGame = vi.fn();

    beforeEach(() => {
        vi.mocked(useGameStore).mockImplementation((selector: any) => {
            return selector({ startGame: mockStartGame });
        });
        mockStartGame.mockClear();
    });

    it('renders title and buttons', () => {
        render(<StartScreen />);
        expect(screen.getByText('ROBOTIC JENGA')).toBeInTheDocument();
        expect(screen.getByText('CLASSIC MODE')).toBeInTheDocument();
        expect(screen.getByText('SANDBOX MODE')).toBeInTheDocument();
    });

    it('calls startGame with CLASSIC on classic button click', () => {
        render(<StartScreen />);
        fireEvent.click(screen.getByText('CLASSIC MODE'));
        expect(mockStartGame).toHaveBeenCalledWith('CLASSIC');
    });

    it('calls startGame with SANDBOX on sandbox button click', () => {
        render(<StartScreen />);
        fireEvent.click(screen.getByText('SANDBOX MODE'));
        expect(mockStartGame).toHaveBeenCalledWith('SANDBOX');
    });
});
