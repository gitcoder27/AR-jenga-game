import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export function calculateDepth(landmarks: NormalizedLandmark[]) {
    if (!landmarks || landmarks.length <= 9) return 0;

    const wrist = landmarks[0];
    const middleMCP = landmarks[9];

    // Euclidean distance in 2D plane
    const dx = wrist.x - middleMCP.x;
    const dy = wrist.y - middleMCP.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Tunable parameters
    const MIN_DIST = 0.05; // Hand far
    const MAX_DIST = 0.3;  // Hand close
    const MIN_Z = -2.5; // Pushing deep (halved for closer interaction)
    const MAX_Z = 2; // Safe distance (halved for closer interaction)

    const clampedDist = Math.max(MIN_DIST, Math.min(MAX_DIST, distance));

    const t = (clampedDist - MIN_DIST) / (MAX_DIST - MIN_DIST);

    return MIN_Z + t * (MAX_Z - MIN_Z);
}
