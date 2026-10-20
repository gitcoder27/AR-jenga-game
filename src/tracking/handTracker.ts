import { TRACKING_LOSS_GRACE_S } from '../game/config';
import {
    calculateConfidence,
    calculateGestureMetrics,
    transitionGestureState,
    type GestureState,
} from '../utils/gestureState';
import { DEFAULT_DEPTH_SETTINGS, depthFromHandSize, handSize, type DepthSettings } from '../utils/depth';
import { OneEuroFilter, type OneEuroParams } from './oneEuro';

export interface Landmark {
    x: number;
    y: number;
    z: number;
}

export interface HandGesture {
    state: GestureState;
    isPinching: boolean;
    isOpenPalm: boolean;
    /** A pinch is forming but not yet confirmed (debounce): neither open nor pinching (G-4) */
    isClosing: boolean;
    /** 0–1, how committed the gesture is */
    confidence: number;
}

/** One processed detection: what every consumer of the hand reads (H-6, H-7). */
export interface TrackedHand {
    /** The 21 filtered landmarks, MediaPipe normalized image coordinates */
    landmarks: Landmark[];
    gesture: HandGesture;
    /** Hand-size depth in [-1, 1] (see depthFromHandSize), from its own, steadier filter */
    depth: number;
    /** The filtered hand size it came from (frame heights, see handSize): what calibration records */
    size: number;
    /** Detection timestamp (ms) */
    timestamp: number;
}

/*
 * One Euro parameters, tuned on synthetic streams (handTracker.test.ts) for
 * still-hand jitter and step lag in world units at the default camera.
 * Landmarks: per coordinate, in aspect-corrected normalized image units.
 */
export const LANDMARK_FILTER: OneEuroParams = { minCutoff: 0.3, beta: 15, dCutoff: 4 };
/*
 * Depth: the wrist→middle-MCP image length. It is a difference of two
 * landmarks a fraction of the frame apart, and the depth mapping magnifies it
 * about 100× into world units, so it gets a steadier filter of its own.
 */
export const DEPTH_FILTER: OneEuroParams = { minCutoff: 0.25, beta: 100, dCutoff: 1 };
/** A frame whose hand centroid jumps more than this many palm lengths, and isn't confirmed by the next frame, is dropped */
export const OUTLIER_JUMP_PALMS = 0.5;

const IDLE_GESTURE: HandGesture = { state: 'IDLE', isPinching: false, isOpenPalm: false, isClosing: false, confidence: 0 };

/**
 * The single source of hand data (H-6, H-7). Each detection goes through,
 * once, in order:
 *
 * 1. Outlier rejection: a frame whose whole-hand centroid jumps more than
 *    OUTLIER_JUMP_PALMS palm lengths is dropped, unless the frame before was
 *    dropped too (two jumps in a row are a real fast move, at one frame's delay).
 * 2. A One Euro filter per landmark coordinate, and a steadier one for the
 *    hand-size depth, timed by the detection timestamps.
 * 3. The gesture state machine, on the filtered landmarks and the same timestamps.
 *
 * Tracking loss (H-5): within TRACKING_LOSS_GRACE_S the gesture and filters
 * carry on; after a longer loss they start over.
 */
export class HandTracker {
    private readonly filters: OneEuroFilter[];
    private readonly depthFilter: OneEuroFilter;
    private last: TrackedHand | null = null;
    /** Centroid and palm length (aspect-corrected) of the last accepted raw frame */
    private anchor: { x: number; y: number; palm: number } | null = null;
    private droppedLast = false;
    private lastTime: number | null = null;
    private lostSince: number | null = null;

    private gestureState: GestureState = 'IDLE';
    private readyTimestamp: number | null = null;
    private lastPinchEnd = 0;

    constructor(filter: OneEuroParams = LANDMARK_FILTER, depthFilter: OneEuroParams = DEPTH_FILTER) {
        this.filters = Array.from({ length: 21 * 3 }, () => new OneEuroFilter(filter));
        this.depthFilter = new OneEuroFilter(depthFilter);
    }

    /**
     * Feed one detection: the raw landmarks of the first hand (undefined when no
     * hand was found), the detection timestamp in ms, the video's width / height
     * and the depth direction and calibration (H-3, H-4).
     * Returns the tracked hand, or null while there is none.
     */
    update(raw: readonly Landmark[] | undefined, timestamp: number, aspect = 1, depthSettings: DepthSettings = DEFAULT_DEPTH_SETTINGS): TrackedHand | null {
        if (!raw || raw.length < 21) {
            this.lostSince ??= timestamp;
            return null;
        }
        if (this.lostSince !== null && timestamp - this.lostSince > TRACKING_LOSS_GRACE_S * 1000) this.restart();
        this.lostSince = null;

        if (this.isOutlier(raw, aspect)) {
            this.droppedLast = true;
            return this.last;
        }
        this.droppedLast = false;

        const dt = this.lastTime === null ? 0 : (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;
        const landmarks = raw.map((l, i) => ({
            x: this.filters[i * 3].filter(l.x * aspect, dt) / aspect,
            y: this.filters[i * 3 + 1].filter(l.y, dt),
            z: this.filters[i * 3 + 2].filter(l.z * aspect, dt) / aspect,
        }));
        const size = this.depthFilter.filter(handSize(raw, aspect), dt);
        const depth = depthFromHandSize(size, depthSettings);
        this.last = { landmarks, gesture: this.updateGesture(landmarks, timestamp, aspect), depth, size, timestamp };
        return this.last;
    }

    /** Forget everything, e.g. when the game restarts. */
    restart(): void {
        for (const f of this.filters) f.reset();
        this.depthFilter.reset();
        this.last = null;
        this.anchor = null;
        this.droppedLast = false;
        this.lastTime = null;
        this.lostSince = null;
        this.gestureState = 'IDLE';
        this.readyTimestamp = null;
        this.lastPinchEnd = 0;
    }

    private isOutlier(raw: readonly Landmark[], aspect: number): boolean {
        let x = 0, y = 0;
        for (const l of raw) {
            x += l.x * aspect;
            y += l.y;
        }
        x /= raw.length;
        y /= raw.length;
        const palm = Math.hypot((raw[9].x - raw[0].x) * aspect, raw[9].y - raw[0].y);
        const previous = this.anchor;
        if (previous && !this.droppedLast && Math.hypot(x - previous.x, y - previous.y) > OUTLIER_JUMP_PALMS * previous.palm) return true;
        this.anchor = { x, y, palm };
        return false;
    }

    private updateGesture(landmarks: Landmark[], now: number, aspect: number): HandGesture {
        const metrics = calculateGestureMetrics(landmarks, aspect);
        if (!metrics) return IDLE_GESTURE;
        const wasPinching = this.gestureState === 'PINCHING';
        const { newState, newReadyTimestamp } = transitionGestureState(this.gestureState, metrics, this.readyTimestamp, now, this.lastPinchEnd);
        if (wasPinching && newState !== 'PINCHING') this.lastPinchEnd = now;
        this.gestureState = newState;
        this.readyTimestamp = newReadyTimestamp;
        return {
            state: newState,
            isPinching: newState === 'PINCHING',
            isOpenPalm: newState === 'OPEN_PALM',
            isClosing: newState === 'PINCH_READY',
            confidence: calculateConfidence(newState, metrics),
        };
    }
}
