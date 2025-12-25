import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export function calculateDepth(landmarks: NormalizedLandmark[]) {
    if (!landmarks || landmarks.length <= 9) return 0;

    const wrist = landmarks[0];
    const middleMCP = landmarks[9];

    // SECONDARY: Hand size heuristic (useful for stability)
    const dx = wrist.x - middleMCP.x;
    const dy = wrist.y - middleMCP.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Tunable parameters for size-based depth
    const MIN_DIST = 0.02; // Hand far
    const MAX_DIST = 0.35;  // Hand close
    const clampedDist = Math.max(MIN_DIST, Math.min(MAX_DIST, distance));

    const t = (clampedDist - MIN_DIST) / (MAX_DIST - MIN_DIST);

    // Range: -8 (far) to +8 (close) relative to anchor
    // Increased range to ensure user can reach the tower
    const zFromSize = -8 + t * 16;

    return zFromSize;
}


