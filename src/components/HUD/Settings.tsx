import React, { useEffect } from 'react';
import { useGameStore, type CalibrationStatus } from '../../store/gameStore';
import { CALIBRATION_PHASE_MS } from '../../game/config';

const CALIBRATION_TEXT: Record<Exclude<CalibrationStatus, 'idle'>, string> = {
    near: 'HOLD YOUR HAND AS NEAR THE WEBCAM AS IS COMFORTABLE',
    far: 'NOW AS FAR FROM THE WEBCAM AS IS COMFORTABLE',
    done: 'DEPTH CALIBRATED: YOUR NEAR AND FAR NOW SPAN THE SCENE',
    'no-hand': "COULDN'T SEE YOUR HAND. KEEP IT IN VIEW AND TRY AGAIN",
    'too-similar': 'NEAR AND FAR LOOKED TOO ALIKE. MOVE FURTHER BETWEEN THEM AND TRY AGAIN',
};

/**
 * Settings panel: the view (RESET VIEW, M-5 moved it here from the bar), which
 * way the hand moves in depth (H-3), and the 5-second near/far calibration (H-4).
 */
export const SettingsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const depthSettings = useGameStore((s) => s.depthSettings);
    const resetView = useGameStore((s) => s.resetView);
    const heldBlockId = useGameStore((s) => s.heldBlockId);
    const setReachIn = useGameStore((s) => s.setReachIn);
    const startCalibration = useGameStore((s) => s.startCalibration);
    const clearCalibration = useGameStore((s) => s.clearCalibration);
    const { reachIn, calibration } = depthSettings;

    return (
        <div className="hud-settings-panel" role="dialog" aria-label="Settings">
            <p className="hud-settings-label">VIEW</p>
            <div className="hud-settings-row">
                <button className="hud-button" onClick={resetView}>RESET VIEW</button>
            </div>
            <p className="hud-settings-label">MOVING YOUR HAND TOWARD THE WEBCAM MOVES IT:</p>
            <div className="hud-settings-row">
                <button className={`hud-button ${!reachIn ? 'active' : ''}`} aria-pressed={!reachIn} onClick={() => setReachIn(false)}>
                    TOWARD YOU
                </button>
                <button className={`hud-button ${reachIn ? 'active' : ''}`} aria-pressed={reachIn} onClick={() => setReachIn(true)}>
                    INTO THE SCENE
                </button>
            </div>
            <p className="hud-settings-label">
                RANGE: {calibration ? 'CALIBRATED' : 'DEFAULT'}
            </p>
            <div className="hud-settings-row">
                <button
                    className="hud-button"
                    disabled={heldBlockId !== null}
                    onClick={() => {
                        startCalibration();
                        onClose();
                    }}
                >
                    CALIBRATE (5 S)
                </button>
                {calibration && (
                    <button className="hud-button" onClick={clearCalibration}>
                        DEFAULT RANGE
                    </button>
                )}
            </div>
            <button className="hud-settings-close" onClick={onClose} aria-label="Close settings">×</button>
        </div>
    );
};

/** The calibration's prompts and outcome (H-4) */
export const CalibrationOverlay: React.FC = () => {
    const status = useGameStore((s) => s.calibrationStatus);
    const setStatus = useGameStore((s) => s.setCalibrationStatus);
    const startCalibration = useGameStore((s) => s.startCalibration);

    // Success clears itself
    useEffect(() => {
        if (status !== 'done') return;
        const timer = setTimeout(() => setStatus('idle'), 2500);
        return () => clearTimeout(timer);
    }, [status, setStatus]);

    if (status === 'idle') return null;
    const running = status === 'near' || status === 'far';
    const failed = status === 'no-hand' || status === 'too-similar';
    return (
        <div className="hud-calibration" role="status" data-status={status}>
            {running && <p className="hud-calibration-step">STEP {status === 'near' ? 1 : 2} OF 2</p>}
            <p>{CALIBRATION_TEXT[status]}</p>
            {running && (
                // Restarts for each step: keyed by it
                <div key={status} className="hud-calibration-bar" style={{ animationDuration: `${CALIBRATION_PHASE_MS}ms` }} />
            )}
            {(running || failed) && (
                <div className="hud-modal-actions">
                    {failed && <button className="hud-button" onClick={startCalibration}>TRY AGAIN</button>}
                    <button className="hud-button" onClick={() => setStatus('idle')}>{running ? 'CANCEL' : 'CLOSE'}</button>
                </div>
            )}
        </div>
    );
};
