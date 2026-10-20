import { describe, expect, it } from 'vitest';
import { CALIBRATION_PHASE_MS } from '../game/config';
import { DepthCalibrator, type CalibrationStep } from './depthCalibration';
import type { TrackedHand } from './handTracker';

const handOfSize = (size: number, timestamp: number): TrackedHand => ({
    landmarks: [],
    gesture: { state: 'IDLE', isPinching: false, isOpenPalm: false, isClosing: false, confidence: 0 },
    depth: 0,
    size,
    timestamp,
});

/** 30 fps detections until the calibration ends; `size(t)` null means no hand. Returns every step. */
function calibrate(size: (t: number) => number | null): CalibrationStep[] {
    const calibrator = new DepthCalibrator();
    const steps: CalibrationStep[] = [];
    for (let t = 0; t <= 2 * CALIBRATION_PHASE_MS + 100; t += 1000 / 30) {
        const s = size(t);
        const step = calibrator.update(s === null ? null : handOfSize(s, t), t);
        steps.push(step);
        if (!('phase' in step)) break;
    }
    return steps;
}

describe('DepthCalibrator [H-4]', () => {
    it('asks for near, then far, then records both ends', () => {
        // The hand takes ~1 s to get to each position: only the settled part counts
        const steps = calibrate((t) => (t < 1000 ? 0.2 : t < CALIBRATION_PHASE_MS ? 0.3 : t < CALIBRATION_PHASE_MS + 1000 ? 0.2 : 0.12));
        expect(steps[0]).toEqual({ phase: 'near' });
        expect(steps).toContainEqual({ phase: 'far' });
        expect(steps.at(-1)).toEqual({ done: { near: 0.3, far: 0.12 } });
    });

    it('fails without a hand in view', () => {
        expect(calibrate((t) => (t < CALIBRATION_PHASE_MS ? 0.3 : null)).at(-1)).toEqual({ failed: 'no-hand' });
    });

    it('fails when near and far look too alike', () => {
        expect(calibrate((t) => (t < CALIBRATION_PHASE_MS ? 0.2 : 0.18)).at(-1)).toEqual({ failed: 'too-similar' });
    });

    it('ignores a stray detection: each end is a median', () => {
        const steps = calibrate((t) => (t < CALIBRATION_PHASE_MS ? (Math.abs(t - 2200) < 20 ? 0.9 : 0.3) : 0.1));
        expect(steps.at(-1)).toEqual({ done: { near: 0.3, far: 0.1 } });
    });
});
