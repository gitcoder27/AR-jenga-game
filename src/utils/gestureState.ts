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

// Thresholds with hysteresis bands to prevent flickering
export const PINCH_ENTER_THRESHOLD = 0.06;  // Must be closer than this to start pinch
export const PINCH_EXIT_THRESHOLD = 0.10;   // Must be farther than this to end pinch

// Open palm detection: fingers must be far from wrist (extended)
export const PALM_FINGER_MIN_DIST = 0.28;   // Each finger must be at least this far from wrist
export const PALM_FINGER_SPREAD = 0.08;     // Adjacent fingers must be at least this far apart

// Minimum time (ms) gesture must be held before activating
export const GESTURE_DEBOUNCE_MS = 80;

// Cooldown after pinch release before other gestures can activate
export const POST_PINCH_COOLDOWN_MS = 200;

export interface GestureMetrics {
    pinchDistance: number;      // Distance between thumb tip and index tip
    avgFingerExtension: number; // Average distance of fingertips from wrist
    fingerSpread: number;       // Average distance between adjacent fingertips
    allFingersExtended: boolean;// Are all 4 fingers extended enough?
    thumbExtended: boolean;     // Is thumb extended?
}

export interface GestureResult {
    state: GestureState;
    confidence: number;         // 0-1 how "committed" the gesture is
    pinchPoint: { x: number; y: number; z: number } | null;
}

/**
 * Calculate gesture metrics from landmarks
 */
export function calculateGestureMetrics(
    landmarks: Array<{ x: number; y: number; z: number }> | undefined
): GestureMetrics | null {
    if (!landmarks || landmarks.length < 21) return null;

    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    // Pinch distance (thumb to index)
    const pinchDistance = distance3D(thumbTip, indexTip);

    // Finger extension distances from wrist
    const thumbDist = distance3D(wrist, thumbTip);
    const indexDist = distance3D(wrist, indexTip);
    const middleDist = distance3D(wrist, middleTip);
    const ringDist = distance3D(wrist, ringTip);
    const pinkyDist = distance3D(wrist, pinkyTip);

    const avgFingerExtension = (indexDist + middleDist + ringDist + pinkyDist) / 4;

    // Calculate spread between adjacent fingers
    const indexMiddleSpread = distance3D(indexTip, middleTip);
    const middleRingSpread = distance3D(middleTip, ringTip);
    const ringPinkySpread = distance3D(ringTip, pinkyTip);
    const fingerSpread = (indexMiddleSpread + middleRingSpread + ringPinkySpread) / 3;

    // Check if fingers are extended (for open palm)
    const allFingersExtended =
        indexDist > PALM_FINGER_MIN_DIST &&
        middleDist > PALM_FINGER_MIN_DIST &&
        ringDist > PALM_FINGER_MIN_DIST &&
        pinkyDist > PALM_FINGER_MIN_DIST;

    const thumbExtended = thumbDist > PALM_FINGER_MIN_DIST * 0.8;

    return {
        pinchDistance,
        avgFingerExtension,
        fingerSpread,
        allFingersExtended,
        thumbExtended,
    };
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
    const { pinchDistance, allFingersExtended, thumbExtended, fingerSpread } = metrics;

    // Calculate if conditions are met
    const pinchConditionEnter = pinchDistance < PINCH_ENTER_THRESHOLD;
    const pinchConditionExit = pinchDistance > PINCH_EXIT_THRESHOLD;

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
            const normalized = 1 - (metrics.pinchDistance / PINCH_EXIT_THRESHOLD);
            return Math.max(0, Math.min(1, normalized));
        }
        case 'OPEN_PALM':
        case 'PALM_READY': {
            // More extended + more spread = higher confidence
            const extNorm = Math.min(1, metrics.avgFingerExtension / 0.4);
            const spreadNorm = Math.min(1, metrics.fingerSpread / 0.15);
            return (extNorm + spreadNorm) / 2;
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
