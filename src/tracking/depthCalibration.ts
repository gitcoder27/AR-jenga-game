import {
    CALIBRATION_MIN_RATIO,
    CALIBRATION_MIN_SAMPLES,
    CALIBRATION_PHASE_MS,
    CALIBRATION_SAMPLE_MS,
} from '../game/config';
import type { DepthCalibration } from '../utils/depth';
import type { TrackedHand } from './handTracker';

export type CalibrationStep =
    | { phase: 'near' | 'far' }
    | { done: DepthCalibration }
    | { failed: 'no-hand' | 'too-similar' };

const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
};

/**
 * The 5-second depth calibration (H-4): the hand held as near the webcam as
 * is comfortable, then as far, CALIBRATION_PHASE_MS each. Each end is the
 * median hand size over the last CALIBRATION_SAMPLE_MS of its phase. Fed once
 * per detection with the tracker's timestamps; starts at the first update
 * after construction or reset().
 */
export class DepthCalibrator {
    private start: number | null = null;
    private near: number[] = [];
    private far: number[] = [];

    reset(): void {
        this.start = null;
        this.near = [];
        this.far = [];
    }

    update(hand: TrackedHand | null, now: number): CalibrationStep {
        this.start ??= now;
        const t = now - this.start;
        if (t < 2 * CALIBRATION_PHASE_MS) {
            const near = t < CALIBRATION_PHASE_MS;
            const sinceStart = near ? t : t - CALIBRATION_PHASE_MS;
            if (hand && sinceStart >= CALIBRATION_PHASE_MS - CALIBRATION_SAMPLE_MS) (near ? this.near : this.far).push(hand.size);
            return { phase: near ? 'near' : 'far' };
        }
        const step = this.result();
        this.reset();
        return step;
    }

    private result(): CalibrationStep {
        if (this.near.length < CALIBRATION_MIN_SAMPLES || this.far.length < CALIBRATION_MIN_SAMPLES) return { failed: 'no-hand' };
        const near = median(this.near), far = median(this.far);
        if (near < far * CALIBRATION_MIN_RATIO) return { failed: 'too-similar' };
        return { done: { near, far } };
    }
}
