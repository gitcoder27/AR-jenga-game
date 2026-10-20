/**
 * Canonical 21-landmark hand poses for tests (unit gesture tests and the E2E
 * scripted hand). Coordinates are in palm-length units (wrist → middle MCP = 1)
 * in image space: x right, y down, wrist at the origin, fingers pointing up.
 *
 * Proportions follow GAME_REVIEW.md H-1: the claw's thumb and index tips are
 * 0.9 palm apart, the relaxed hand's fingertips are ~1.5–1.8 palm from the wrist.
 */

export type PoseName = 'open' | 'relaxed' | 'claw' | 'fist' | 'pinch' | 'tuckedReady' | 'tuckedPinch';

type P = [number, number];

const PALM: Record<number, P> = {
    0: [0, 0],
    1: [-0.3, -0.2],
    2: [-0.55, -0.42],
    5: [-0.27, -0.95],
    9: [0, -1],
    13: [0.24, -0.93],
    17: [0.43, -0.8],
};

const RELAXED_MIDDLE_RING_PINKY: Record<number, P> = {
    10: [-0.02, -1.42], 11: [-0.03, -1.65], 12: [-0.04, -1.78],
    14: [0.25, -1.32], 15: [0.26, -1.52], 16: [0.26, -1.62],
    18: [0.5, -1.1], 19: [0.54, -1.26], 20: [0.56, -1.36],
};

const TUCKED_MIDDLE_RING_PINKY: Record<number, P> = {
    10: [0, -1.08], 11: [0.01, -0.88], 12: [0.02, -0.66],
    14: [0.24, -1.02], 15: [0.23, -0.83], 16: [0.22, -0.62],
    18: [0.44, -0.9], 19: [0.41, -0.74], 20: [0.38, -0.58],
};

const POSES: Record<PoseName, Record<number, P>> = {
    // Deliberate, fully spread open palm
    open: {
        3: [-0.8, -0.62], 4: [-1.02, -0.8],
        6: [-0.38, -1.42], 7: [-0.45, -1.7], 8: [-0.51, -1.93],
        10: [0, -1.5], 11: [0, -1.83], 12: [0, -2.08],
        14: [0.33, -1.4], 15: [0.4, -1.7], 16: [0.47, -1.93],
        18: [0.62, -1.15], 19: [0.74, -1.37], 20: [0.83, -1.56],
    },
    // Natural neutral hand: fingers loosely extended and close together
    relaxed: {
        3: [-0.72, -0.6], 4: [-0.85, -0.8],
        6: [-0.32, -1.35], 7: [-0.34, -1.55], 8: [-0.34, -1.68],
        ...RELAXED_MIDDLE_RING_PINKY,
    },
    // Half-open claw reaching for a block
    claw: {
        3: [-0.85, -0.38], 4: [-1.05, -0.42],
        6: [-0.33, -1.35], 7: [-0.33, -1.2], 8: [-0.3, -0.92],
        10: [-0.02, -1.42], 11: [-0.04, -1.25], 12: [-0.05, -0.97],
        14: [0.26, -1.33], 15: [0.24, -1.15], 16: [0.2, -0.9],
        18: [0.48, -1.08], 19: [0.47, -0.95], 20: [0.42, -0.8],
    },
    // Closed fist, thumb wrapped over the index finger
    fist: {
        3: [-0.45, -0.6], 4: [-0.22, -0.7],
        6: [-0.3, -1.08], 7: [-0.26, -0.86], 8: [-0.2, -0.62],
        10: [0, -1.12], 11: [0.01, -0.9], 12: [0.02, -0.65],
        14: [0.24, -1.05], 15: [0.23, -0.84], 16: [0.22, -0.62],
        18: [0.44, -0.92], 19: [0.41, -0.75], 20: [0.38, -0.58],
    },
    // Thumb and index tips touching, other fingers relaxed
    pinch: {
        3: [-0.78, -0.88], 4: [-0.72, -1.24],
        6: [-0.4, -1.32], 7: [-0.55, -1.4], 8: [-0.68, -1.3],
        ...RELAXED_MIDDLE_RING_PINKY,
    },
    // Index finger hooked sideways towards the thumb, other fingers tucked: the
    // thumb and index tips are the top of the hand in the image. Because the
    // mapping is camera-relative and the camera pitches down, landmarks above the
    // pinch point land deeper in the scene; these poses keep the rest of the
    // hand from reaching past the fingertips.
    tuckedReady: {
        3: [-1.05, -0.8], 4: [-1.3, -1.05],
        6: [-0.5, -1.1], 7: [-0.68, -1.15], 8: [-0.8, -1.12],
        ...TUCKED_MIDDLE_RING_PINKY,
    },
    tuckedPinch: {
        3: [-0.78, -0.82], 4: [-0.83, -1.08],
        6: [-0.5, -1.1], 7: [-0.68, -1.15], 8: [-0.8, -1.12],
        ...TUCKED_MIDDLE_RING_PINKY,
    },
};

export interface Landmark {
    x: number;
    y: number;
    z: number;
}

/** Pose joints in palm units, indexed 0–20. */
export function poseJoints(name: PoseName): P[] {
    const joints = { ...PALM, ...POSES[name] };
    return Array.from({ length: 21 }, (_, i) => joints[i]);
}

/**
 * Landmarks for `pose` with a palm length of `palmSize` (normalized image
 * units) and the thumb–index midpoint at (`x`, `y`). `aspect` is the video's
 * width / height, so the hand keeps its shape in pixels.
 */
export function buildLandmarks(pose: PoseName, palmSize: number, x: number, y: number, aspect = 1): Landmark[] {
    const joints = poseJoints(pose);
    const ax = (joints[4][0] + joints[8][0]) / 2;
    const ay = (joints[4][1] + joints[8][1]) / 2;
    return joints.map(([px, py]) => ({
        x: x + ((px - ax) * palmSize) / aspect,
        y: y + (py - ay) * palmSize,
        z: 0,
    }));
}
