import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

// Wrist→middle-MCP length in the image, from hand far to hand close
const MIN_DIST = 0.02;
const MAX_DIST = 0.35;

/**
 * Hand-size depth in [-1, 1]: -1 when the hand is small (far from the webcam),
 * +1 when it is large (close). tracking/mapping.ts turns it into world depth.
 */
export function calculateDepth(landmarks: NormalizedLandmark[]) {
    if (!landmarks || landmarks.length <= 9) return 0;

    const wrist = landmarks[0];
    const middleMCP = landmarks[9];
    const distance = Math.hypot(wrist.x - middleMCP.x, wrist.y - middleMCP.y);
    const clampedDist = Math.max(MIN_DIST, Math.min(MAX_DIST, distance));
    const t = (clampedDist - MIN_DIST) / (MAX_DIST - MIN_DIST);
    return 2 * t - 1;
}

/** Inverse of calculateDepth: the wrist→middle-MCP image length that yields `depth`. */
export function palmSizeForDepth(depth: number): number {
    const t = (Math.max(-1, Math.min(1, depth)) + 1) / 2;
    return MIN_DIST + t * (MAX_DIST - MIN_DIST);
}
