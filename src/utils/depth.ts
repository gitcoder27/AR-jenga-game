import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

// Tunable parameters for size-based depth
const MIN_DIST = 0.02; // Hand far
const MAX_DIST = 0.35;  // Hand close
// Range: -8 (far) to +8 (close) relative to anchor
const Z_RANGE = 8;

export function calculateDepth(landmarks: NormalizedLandmark[]) {
    if (!landmarks || landmarks.length <= 9) return 0;

    const wrist = landmarks[0];
    const middleMCP = landmarks[9];

    // SECONDARY: Hand size heuristic (useful for stability)
    const dx = wrist.x - middleMCP.x;
    const dy = wrist.y - middleMCP.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const clampedDist = Math.max(MIN_DIST, Math.min(MAX_DIST, distance));

    const t = (clampedDist - MIN_DIST) / (MAX_DIST - MIN_DIST);

    // Increased range to ensure user can reach the tower
    const zFromSize = -Z_RANGE + t * 2 * Z_RANGE;

    return zFromSize;
}

/** Inverse of calculateDepth: the wrist→middle-MCP image length that yields `handZ`. */
export function palmSizeForDepth(handZ: number): number {
    const t = (Math.max(-Z_RANGE, Math.min(Z_RANGE, handZ)) + Z_RANGE) / (2 * Z_RANGE);
    return MIN_DIST + t * (MAX_DIST - MIN_DIST);
}
