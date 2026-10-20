/**
 * Gesture State Machine
 * 
 * Provides hysteresis-based gesture detection with mutual exclusion.
 * 
 * Gestures:
 * - PINCHING: Thumb + index close together (for grabbing blocks)
 * - OPEN_PALM: All 5 fingers spread wide (for camera control)
 */

export type GestureState = 'IDLE' | 'PINCH_READY' | 'PINCHING' | 'PALM_READY' | 'OPEN_PALM';

/*
 * All distances are measured in palm lengths in aspect-corrected image space,
 * so a pose classifies the same at any hand distance (H-1) and in any video
 * aspect ratio. MediaPipe normalizes x by the frame width and y by its height,
 * so raw horizontal gaps on a 16:9 camera read 1.78x too small.
 */

// Pinch: thumb–index tip gap / palm, with a hysteresis band
export const PINCH_ENTER_THRESHOLD = 0.25;  // Must be closer than this to start pinch
export const PINCH_EXIT_THRESHOLD = 0.40;   // Must be farther than this to end pinch

/** A finger is extended when both its PIP and DIP joints bend less than this (degrees) */
export const FINGER_STRAIGHT_MAX_BEND = 35;
/** An index finger bent more than this at the PIP is folded into a fist, so it can't be pinching */
export const INDEX_FOLDED_MIN_BEND = 120;
/** Open palm: the thumb tip must be at least this far from the index knuckle (palm lengths) */
export const PALM_THUMB_MIN_REACH = 0.68;
/** Open palm: adjacent fingertips must be at least this far apart on average (palm lengths) */
export const PALM_FINGER_SPREAD = 0.43;

// Minimum time (ms) gesture must be held before activating
export const GESTURE_DEBOUNCE_MS = 80;

// Cooldown after pinch release before other gestures can activate
export const POST_PINCH_COOLDOWN_MS = 200;

export interface GestureMetrics {
    /** Hand scale in aspect-corrected image units: max(|wrist→middle MCP|, |index MCP→pinky MCP| × 1.4) */
    palmSize: number;
    /** Thumb tip to index tip, in palm lengths */
    pinchRatio: number;
    /** Average gap between adjacent fingertips, in palm lengths */
    fingerSpread: number;
    /** Index, middle, ring and pinky all straight (joint angles) */
    allFingersExtended: boolean;
    /** Thumb straight and reaching away from the index knuckle */
    thumbExtended: boolean;
    /** Index finger curled into the palm (fist), which rules out a pinch */
    indexFolded: boolean;
}

export interface GestureResult {
    state: GestureState;
    confidence: number;         // 0-1 how "committed" the gesture is
    pinchPoint: { x: number; y: number; z: number } | null;
}

type Point = { x: number; y: number; z: number };

const FINGERS = [
    [5, 6, 7, 8],     // index: MCP, PIP, DIP, tip
    [9, 10, 11, 12],  // middle
    [13, 14, 15, 16], // ring
    [17, 18, 19, 20], // pinky
] as const;

/**
 * Calculate scale-free gesture metrics from landmarks. `aspect` is the video's
 * width / height.
 */
export function calculateGestureMetrics(
    landmarks: Array<Point> | undefined,
    aspect = 1,
): GestureMetrics | null {
    if (!landmarks || landmarks.length < 21) return null;

    // Into one isotropic unit: image heights (MediaPipe's z uses the x scale)
    const p = landmarks.map((l) => ({ x: l.x * aspect, y: l.y, z: l.z * aspect }));

    const palmSize = Math.max(distance3D(p[0], p[9]), distance3D(p[5], p[17]) * 1.4);
    if (palmSize === 0) return null;

    const pinchRatio = distance3D(p[4], p[8]) / palmSize;
    const fingerSpread = (distance3D(p[8], p[12]) + distance3D(p[12], p[16]) + distance3D(p[16], p[20])) / 3 / palmSize;

    const allFingersExtended = FINGERS.every(([mcp, pip, dip, tip]) =>
        bendDegrees(p[mcp], p[pip], p[dip]) < FINGER_STRAIGHT_MAX_BEND &&
        bendDegrees(p[pip], p[dip], p[tip]) < FINGER_STRAIGHT_MAX_BEND);

    const thumbExtended =
        bendDegrees(p[1], p[2], p[3]) < FINGER_STRAIGHT_MAX_BEND &&
        bendDegrees(p[2], p[3], p[4]) < FINGER_STRAIGHT_MAX_BEND &&
        distance3D(p[4], p[5]) / palmSize > PALM_THUMB_MIN_REACH;

    const indexFolded = bendDegrees(p[5], p[6], p[7]) > INDEX_FOLDED_MIN_BEND;

    return { palmSize, pinchRatio, fingerSpread, allFingersExtended, thumbExtended, indexFolded };
}

/**
 * Transition gesture state based on current metrics
 * Uses hysteresis to prevent flickering
 */
export function transitionGestureState(
    currentState: GestureState,
    metrics: GestureMetrics,
    readyTimestamp: number | null,
    now: number,
    lastPinchEndTime: number = 0
): { newState: GestureState; newReadyTimestamp: number | null } {
    const { pinchRatio, allFingersExtended, thumbExtended, fingerSpread, indexFolded } = metrics;

    // Calculate if conditions are met. A fist brings the thumb onto the index
    // finger too, so a folded index never starts a pinch.
    const pinchConditionEnter = pinchRatio < PINCH_ENTER_THRESHOLD && !indexFolded;
    const pinchConditionExit = pinchRatio > PINCH_EXIT_THRESHOLD;

    // Open palm: all fingers extended AND spread apart AND thumb extended
    const palmCondition = allFingersExtended && thumbExtended && fingerSpread > PALM_FINGER_SPREAD;

    // Check cooldown after pinch release
    const inPostPinchCooldown = (now - lastPinchEndTime) < POST_PINCH_COOLDOWN_MS;

    switch (currentState) {
        case 'IDLE':
            // Pinch has highest priority
            if (pinchConditionEnter) {
                return { newState: 'PINCH_READY', newReadyTimestamp: now };
            }
            // Open palm only if not in cooldown and not pinching
            if (palmCondition && !inPostPinchCooldown) {
                return { newState: 'PALM_READY', newReadyTimestamp: now };
            }
            return { newState: 'IDLE', newReadyTimestamp: null };

        case 'PINCH_READY':
            // Exit if pinch opened
            if (pinchConditionExit) {
                return { newState: 'IDLE', newReadyTimestamp: null };
            }
            // Activate after debounce
            if (readyTimestamp !== null && (now - readyTimestamp) >= GESTURE_DEBOUNCE_MS) {
                return { newState: 'PINCHING', newReadyTimestamp: null };
            }
            return { newState: 'PINCH_READY', newReadyTimestamp: readyTimestamp };

        case 'PINCHING':
            // Only exit when pinch is clearly released
            if (pinchConditionExit) {
                return { newState: 'IDLE', newReadyTimestamp: null };
            }
            return { newState: 'PINCHING', newReadyTimestamp: null };

        case 'PALM_READY':
            // Exit if palm closed or pinch started
            if (!palmCondition || pinchConditionEnter) {
                return { newState: 'IDLE', newReadyTimestamp: null };
            }
            // Activate after debounce
            if (readyTimestamp !== null && (now - readyTimestamp) >= GESTURE_DEBOUNCE_MS) {
                return { newState: 'OPEN_PALM', newReadyTimestamp: null };
            }
            return { newState: 'PALM_READY', newReadyTimestamp: readyTimestamp };

        case 'OPEN_PALM':
            // Exit if palm closes or pinch gesture starts
            if (!palmCondition || pinchConditionEnter) {
                return { newState: 'IDLE', newReadyTimestamp: null };
            }
            return { newState: 'OPEN_PALM', newReadyTimestamp: null };

        default:
            return { newState: 'IDLE', newReadyTimestamp: null };
    }
}

/**
 * Calculate confidence score (0-1) for current gesture
 */
export function calculateConfidence(state: GestureState, metrics: GestureMetrics): number {
    switch (state) {
        case 'PINCHING':
        case 'PINCH_READY': {
            // Closer = higher confidence
            const normalized = 1 - (metrics.pinchRatio / PINCH_EXIT_THRESHOLD);
            return Math.max(0, Math.min(1, normalized));
        }
        case 'OPEN_PALM':
        case 'PALM_READY': {
            // Wider spread = higher confidence
            return Math.min(1, metrics.fingerSpread / (PALM_FINGER_SPREAD * 1.5));
        }
        default:
            return 0;
    }
}

/**
 * Calculate pinch midpoint for grab targeting
 */
export function calculatePinchPoint(
    landmarks: Array<{ x: number; y: number; z: number }> | undefined
): { x: number; y: number; z: number } | null {
    if (!landmarks || landmarks.length < 9) return null;

    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    return {
        x: (thumbTip.x + indexTip.x) / 2,
        y: (thumbTip.y + indexTip.y) / 2,
        z: (thumbTip.z + indexTip.z) / 2,
    };
}

/** Angle (degrees) between segments a→b and b→c: 0 for a straight joint */
function bendDegrees(a: Point, b: Point, c: Point): number {
    const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
    const vx = c.x - b.x, vy = c.y - b.y, vz = c.z - b.z;
    const lengths = Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz);
    if (lengths === 0) return 0;
    const cos = (ux * vx + uy * vy + uz * vz) / lengths;
    return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

// Helper: 3D Euclidean distance
function distance3D(
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number }
): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
