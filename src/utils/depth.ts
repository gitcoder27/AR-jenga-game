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

    return depthFromPalmLength(palmLength(landmarks));
}

/** Wrist→middle-MCP length in the image (normalized units, as calculateDepth measures it). */
export function palmLength(landmarks: readonly { x: number; y: number }[]): number {
    return Math.hypot(landmarks[0].x - landmarks[9].x, landmarks[0].y - landmarks[9].y);
}

/** calculateDepth for a given wrist→middle-MCP image length. */
export function depthFromPalmLength(length: number): number {
    const clampedDist = Math.max(MIN_DIST, Math.min(MAX_DIST, length));
    const t = (clampedDist - MIN_DIST) / (MAX_DIST - MIN_DIST);
    return 2 * t - 1;
}

/** Inverse of calculateDepth: the wrist→middle-MCP image length that yields `depth`. */
export function palmSizeForDepth(depth: number): number {
    const t = (Math.max(-1, Math.min(1, depth)) + 1) / 2;
    return MIN_DIST + t * (MAX_DIST - MIN_DIST);
}
