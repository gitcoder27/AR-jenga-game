import * as THREE from 'three';

/**
 * Landmark → world mapping shared by the hand, the cursor and the test harness.
 *
 * The interaction volume is a box in front of the camera: normalized image x/y
 * span VIEW_WIDTH × VIEW_HEIGHT world units, and depth comes from hand size
 * (see utils/depth.ts) around BASE_DIST.
 */
export const VIEW_WIDTH = 45;
export const VIEW_HEIGHT = 25;
export const BASE_DIST = 20;
/** Scale applied to MediaPipe's relative per-landmark z */
export const LANDMARK_Z_SCALE = 10;

export interface LandmarkLike {
    x: number;
    y: number;
    z: number;
}

const local = new THREE.Vector3();

/**
 * Map a normalized landmark to world space. `handZ` is the hand-size depth
 * offset from calculateDepth(). Writes into `out` when given.
 */
export function landmarkToWorld(
    landmark: LandmarkLike,
    handZ: number,
    camera: THREE.Camera,
    out: THREE.Vector3 = new THREE.Vector3(),
): THREE.Vector3 {
    const lx = (landmark.x - 0.5) * VIEW_WIDTH * -1; // Flip X to match webcam mirror
    const ly = (0.5 - landmark.y) * VIEW_HEIGHT;
    const lz = -(BASE_DIST - handZ) - landmark.z * LANDMARK_Z_SCALE;
    local.set(lx, ly, lz);
    return out.copy(local).applyQuaternion(camera.quaternion).add(camera.position);
}

/**
 * Inverse of landmarkToWorld for a landmark with z = 0: returns the normalized
 * image position and hand-size depth offset that put a landmark at `world`.
 */
export function worldToLandmark(world: LandmarkLike, camera: THREE.Camera): { x: number; y: number; handZ: number } {
    local.set(world.x, world.y, world.z).sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
    return {
        x: 0.5 - local.x / VIEW_WIDTH,
        y: 0.5 - local.y / VIEW_HEIGHT,
        handZ: BASE_DIST + local.z,
    };
}
