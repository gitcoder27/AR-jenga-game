// Hand size in the image, in frame heights, from hand far to hand close (the uncalibrated range)
const MIN_SIZE = 0.02;
const MAX_SIZE = 0.35;

/**
 * Palm width (index MCP → pinky MCP) times this stands in for the palm length
 * (wrist → middle MCP) when the hand pitches. The typical adult ratio is
 * about 1.4; a little less keeps the steadier length in charge for an
 * untilted hand (the width's noise is scaled up by this factor), and the
 * width takes over once pitch has shortened the length by a few percent.
 */
export const PALM_WIDTH_TO_LENGTH = 1.35;

/** The player's comfortable near and far hand sizes, from the calibration (H-4) */
export interface DepthCalibration {
    /** Hand size (frame heights) held as near the webcam as is comfortable */
    near: number;
    /** ... and as far */
    far: number;
}

export interface DepthSettings {
    /** null: the default range */
    calibration: DepthCalibration | null;
    /**
     * Which way the hand moves in the scene when it moves toward the webcam (H-3).
     * Mirror (false, the default): toward the viewer, like a mirror.
     * Reach-in (true): into the scene, away from the viewer.
     */
    reachIn: boolean;
}

export const DEFAULT_DEPTH_SETTINGS: DepthSettings = { calibration: null, reachIn: false };

/**
 * How big the hand looks, in frame heights: the larger of the palm length
 * and PALM_WIDTH_TO_LENGTH × the palm width (H-4). Tilting the fingers
 * toward the webcam shortens the length but not the width, and turning the
 * hand sideways the reverse, so neither moves the hand in depth on its own.
 * `aspect` is the video's width / height (MediaPipe normalizes x by width).
 */
export function handSize(landmarks: readonly { x: number; y: number }[], aspect = 1): number {
    const length = Math.hypot((landmarks[0].x - landmarks[9].x) * aspect, landmarks[0].y - landmarks[9].y);
    const width = Math.hypot((landmarks[5].x - landmarks[17].x) * aspect, landmarks[5].y - landmarks[17].y);
    return Math.max(length, PALM_WIDTH_TO_LENGTH * width);
}

/** Wrist→middle-MCP length in the image (normalized units): the outlier check's yardstick. */
export function palmLength(landmarks: readonly { x: number; y: number }[]): number {
    return Math.hypot(landmarks[0].x - landmarks[9].x, landmarks[0].y - landmarks[9].y);
}

function sizeRange(settings: DepthSettings): [number, number] {
    const c = settings.calibration;
    return c ? [c.far, c.near] : [MIN_SIZE, MAX_SIZE];
}

/**
 * Hand-size depth in [-1, 1] for a hand size: +1 nearest the viewer, which
 * tracking/mapping.ts turns into world depth. In mirror mode a hand near the
 * webcam (large) is +1; reach-in flips it.
 */
export function depthFromHandSize(size: number, settings: DepthSettings = DEFAULT_DEPTH_SETTINGS): number {
    const [small, large] = sizeRange(settings);
    const t = (Math.max(small, Math.min(large, size)) - small) / (large - small);
    const depth = 2 * t - 1;
    return settings.reachIn ? -depth : depth;
}

/** Inverse of depthFromHandSize: the hand size that yields `depth`. */
export function handSizeForDepth(depth: number, settings: DepthSettings = DEFAULT_DEPTH_SETTINGS): number {
    const [small, large] = sizeRange(settings);
    const d = Math.max(-1, Math.min(1, settings.reachIn ? -depth : depth));
    return small + ((d + 1) / 2) * (large - small);
}

/** Hand-size depth for landmarks: depthFromHandSize(handSize(...)). */
export function calculateDepth(landmarks: readonly { x: number; y: number }[], aspect = 1, settings: DepthSettings = DEFAULT_DEPTH_SETTINGS): number {
    if (!landmarks || landmarks.length < 21) return 0;
    return depthFromHandSize(handSize(landmarks, aspect), settings);
}
