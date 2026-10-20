import React, { useEffect } from 'react';
import { useGameStore, type TrackingStatus } from '../../store/gameStore';
import './HUD.css';

const TRACKING_LABELS: Record<TrackingStatus, string> = {
    loading: 'Loading hand tracking…',
    error: 'Hand tracking unavailable',
    'no-hand': 'Show your hand to the camera',
    ready: 'Hand tracked',
};

export const HUD: React.FC = () => {
    const {
        score,
        gameState,
        gameMode,
        resetGame,
        returnToMenu,
        isWebcamVisible,
        setWebcamVisible,
        isInstructionsVisible,
        setInstructionsVisible,
        trackingStatus,
        trackingError,
        trackingDelegate,
        retryTracking,
        resetView,
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
                    <h1 onClick={returnToMenu} style={{ cursor: 'pointer' }}>ROBOTIC JENGA</h1>
                    <div className="hud-status-led" data-state={gameState}></div>
                    <div
                        className="hud-tracking-chip"
                        data-status={trackingStatus}
                        role="status"
                        title={trackingDelegate === 'CPU' ? 'GPU unavailable: hand tracking is running on the CPU and may be slower' : undefined}
                    >
                        {TRACKING_LABELS[trackingStatus]}
                        {trackingDelegate === 'CPU' && trackingStatus !== 'error' && <span className="hud-tracking-cpu"> · CPU</span>}
                    </div>
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

                {gameMode === 'SANDBOX' && (
                    <button className="hud-button sandbox-reset" onClick={resetGame}>
                        RESET TOWER
                    </button>
                )}

                <button className="hud-button" onClick={resetView}>
                    RESET VIEW
                </button>

                <button className="hud-button exit-game" onClick={returnToMenu}>
                    EXIT GAME
                </button>
            </div>

            {/* Hand tracking failed to start (H-9) */}
            {trackingStatus === 'error' && (
                <div className="hud-tracking-error" role="alert">
                    <h2>Hand tracking failed to load</h2>
                    <p>The game needs the hand-tracking model to see your hand.</p>
                    {trackingError && <p className="hud-tracking-error-detail">{trackingError}</p>}
                    <div className="hud-modal-actions">
                        <button className="hud-reset-button" onClick={retryTracking}>RETRY</button>
                        <button className="hud-menu-button" onClick={returnToMenu}>MAIN MENU</button>
                    </div>
                </div>
            )}

            {/* Game Over Modal */}
            {gameState === 'GAME_OVER' && (
                <div className="hud-modal-overlay">
                    <div className="hud-modal">
                        <h2>TOWER COLLAPSED</h2>
                        <div className="hud-final-score">
                            <span className="label">FINAL SCORE</span>
                            <span className="value">{score}</span>
                        </div>
                        <div className="hud-modal-actions">
                            <button className="hud-reset-button" onClick={resetGame}>
                                RE-INITIALIZE
                            </button>
                            <button className="hud-menu-button" onClick={returnToMenu}>
                                MAIN MENU
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
