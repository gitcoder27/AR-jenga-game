import React, { useEffect } from 'react';
import { useGameStore, type TrackingStatus } from '../../store/gameStore';
import type { FoulReason, MovePhase } from '../../game/moves';
import './HUD.css';

const TRACKING_LABELS: Record<TrackingStatus, string> = {
    loading: 'Loading hand tracking…',
    error: 'Hand tracking unavailable',
    'no-hand': 'Show your hand to the camera',
    ready: 'Hand tracked',
};

/** What to do next in a Classic move (C-1) */
const MOVE_HINTS: Record<MovePhase, string | null> = {
    IDLE: null,
    HOLDING: 'PULL IT OUT, THEN PUT IT ON TOP',
    MOVED: 'PICK IT UP AND PUT IT ON TOP',
    SETTLING: 'HOLD ON… WAITING FOR THE TOWER TO SETTLE',
};

const FOULS: Record<FoulReason, { title: string; detail: string }> = {
    'block-fell': { title: 'TOWER COLLAPSED', detail: 'A block fell from the tower.' },
    dropped: { title: 'BLOCK DROPPED', detail: 'The block you were moving fell off the table.' },
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
        movePhase,
        placementTarget,
        foulReason,
        isCameraMode,
        toggleCameraMode,
        heldBlockId,
    } = useGameStore();
    const moveHint = placementTarget !== null && movePhase === 'HOLDING' ? 'LET GO TO PLACE IT' : MOVE_HINTS[movePhase];

    // Keyboard fallback for camera mode (H-2)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'c') return;
            if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return;
            toggleCameraMode();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [toggleCameraMode]);

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

            {/* Camera mode (H-2) takes the hint slot: it is what the hand does right now */}
            {isCameraMode && gameState === 'PLAYING' ? (
                <div className="hud-move-hint" role="status" data-phase="CAMERA">
                    TURNING THE VIEW: MOVE YOUR HAND · PINCH OR PRESS C TO STOP
                </div>
            ) : gameMode === 'CLASSIC' && gameState === 'PLAYING' && moveHint && (
                <div className="hud-move-hint" role="status" data-phase={movePhase}>{moveHint}</div>
            )}

            {/* Instructions Overlay */}
            {isInstructionsVisible && (
                <div className="hud-instructions fade-out">
                    <p>PINCH THUMB + INDEX TO GRAB</p>
                    <p>OPEN YOUR FINGERS TO RELEASE</p>
                    <p>HAND NEARER THE CAMERA = NEARER TO YOU</p>
                    <p>HOLD AN OPEN PALM STILL (OR PRESS C) TO TURN THE VIEW</p>
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

                <button
                    className={`hud-button ${isCameraMode ? 'active' : ''}`}
                    onClick={toggleCameraMode}
                    disabled={heldBlockId !== null}
                    aria-pressed={isCameraMode}
                    title="Turn the view with your hand (C)"
                >
                    TURN VIEW (C)
                </button>

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
                        <h2>{FOULS[foulReason ?? 'block-fell'].title}</h2>
                        {foulReason && <p className="hud-foul-detail">{FOULS[foulReason].detail}</p>}
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
