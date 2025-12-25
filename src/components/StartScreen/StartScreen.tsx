import React from 'react';
import { useGameStore } from '../../store/gameStore';
import './StartScreen.css';

const StartScreen: React.FC = () => {
    const startGame = useGameStore((state) => state.startGame);

    return (
        <div className="start-screen">
            <div className="start-content">
                <div className="start-header">
                    <div className="glitch-title" data-text="ROBOTIC JENGA">ROBOTIC JENGA</div>
                    <div className="start-subtitle">AUGMENTED REALITY SIMULATION</div>
                </div>

                <div className="mode-selection">
                    <button
                        className="start-button classic"
                        onClick={() => startGame('CLASSIC')}
                    >
                        <span className="btn-glitch-content">CLASSIC MODE</span>
                        <span className="btn-desc">TOWER COLLAPSE ENDS GAME</span>
                    </button>

                    <button
                        className="start-button sandbox"
                        onClick={() => startGame('SANDBOX')}
                    >
                        <span className="btn-glitch-content">SANDBOX MODE</span>
                        <span className="btn-desc">INFINITE PLAY & RESET TOWER</span>
                    </button>
                </div>

                <div className="start-footer">
                    <p>SYSTEM READY // CALIBRATE HANDS FOR BEST EXPERIENCE</p>
                </div>
            </div>
        </div>
    );
};

export default StartScreen;
