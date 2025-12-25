import React, { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import './HUD.css';

export const HUD: React.FC = () => {
    const { 
        score, 
        gameState, 
        resetGame, 
        isWebcamVisible, 
        setWebcamVisible,
        isInstructionsVisible,
        setInstructionsVisible
    } = useGameStore();

    useEffect(() => {
        if (isInstructionsVisible) {
            const timer = setTimeout(() => {
                setInstructionsVisible(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [isInstructionsVisible, setInstructionsVisible]);

    return (
        <div className="hud-root">
            {/* Top Bar: Score & Title */}
            <div className="hud-top-bar">
                <div className="hud-title-container">
                    <h1>ROBOTIC JENGA</h1>
                    <div className="hud-status-led" data-state={gameState}></div>
                </div>
                <div className="hud-score">
                    <span className="label">SCORE</span>
                    <span className="value">{score}</span>
                </div>
            </div>

            {/* Instructions Overlay */}
            {isInstructionsVisible && (
                <div className="hud-instructions fade-out">
                    <p>PINCH TO GRAB</p>
                    <p>STEADY HAND TO MOVE</p>
                </div>
            )}

            {/* Bottom Controls */}
            <div className="hud-bottom-controls">
                <button 
                    className={`hud-button ${isWebcamVisible ? 'active' : ''}`}
                    onClick={() => setWebcamVisible(!isWebcamVisible)}
                >
                    {isWebcamVisible ? 'HIDE CAMERA' : 'SHOW CAMERA'}
                </button>
            </div>

            {/* Game Over Modal */}
            {gameState === 'GAME_OVER' && (
                <div className="hud-modal-overlay">
                    <div className="hud-modal">
                        <h2>TOWER COLLAPSED</h2>
                        <div className="hud-final-score">
                            <span className="label">FINAL SCORE</span>
                            <span className="value">{score}</span>
                        </div>
                        <button className="hud-reset-button" onClick={resetGame}>
                            RE-INITIALIZE
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
