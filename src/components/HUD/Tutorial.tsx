import React, { useEffect } from 'react';
import { useGameStore, type GameStore } from '../../store/gameStore';
import { advanceTutorial, TUTORIAL_STEPS, TUTORIAL_TEXT, type TutorialSnapshot } from '../../game/tutorial';

const snapshot = (s: GameStore): TutorialSnapshot => ({
    trackingStatus: s.trackingStatus,
    calibrationStatus: s.calibrationStatus,
    hoveredBlockId: s.hoveredBlockId,
    heldBlockId: s.heldBlockId,
    score: s.score,
});

/** Steps shown as "STEP n OF 6" ('done' isn't one) */
const COUNTED = TUTORIAL_STEPS.length - 1;

/**
 * The guided first run's card (O-1): what to do now, and SKIP. It advances
 * itself on store changes; the pull step ends from TutorialRules (physics).
 */
export const TutorialCard: React.FC = () => {
    const step = useGameStore((s) => s.tutorialStep);
    const startCalibration = useGameStore((s) => s.startCalibration);
    const setTutorialStep = useGameStore((s) => s.setTutorialStep);
    const endTutorial = useGameStore((s) => s.endTutorial);

    useEffect(() => useGameStore.subscribe((now, before) => {
        if (!now.tutorialStep) return;
        const next = advanceTutorial(now.tutorialStep, snapshot(now), snapshot(before));
        if (next !== now.tutorialStep) now.setTutorialStep(next);
    }), []);

    // The last card closes itself
    useEffect(() => {
        if (step !== 'done') return;
        const timer = setTimeout(endTutorial, 6000);
        return () => clearTimeout(timer);
    }, [step, endTutorial]);

    if (!step) return null;
    const { title, body } = TUTORIAL_TEXT[step];
    const index = TUTORIAL_STEPS.indexOf(step);
    return (
        <div className="hud-tutorial" role="region" aria-label="Tutorial" data-step={step}>
            {step !== 'done' && <p className="hud-tutorial-step">TUTORIAL · STEP {index + 1} OF {COUNTED}</p>}
            <h2>{title}</h2>
            <p>{body}</p>
            <div className="hud-tutorial-actions">
                {step === 'calibrate' && (
                    <>
                        <button className="hud-button active" onClick={startCalibration}>CALIBRATE</button>
                        <button className="hud-button" onClick={() => setTutorialStep('touch')}>SKIP THIS STEP</button>
                    </>
                )}
                <button className="hud-button" onClick={endTutorial}>{step === 'done' ? 'CLOSE' : 'SKIP TUTORIAL'}</button>
            </div>
        </div>
    );
};
