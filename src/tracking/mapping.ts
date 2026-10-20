import * as THREE from 'three';
import { CAMERA_TARGET, INDEX_TIP, THUMB_TIP } from '../game/config';

/**
 * Landmark → world mapping shared by the hand, the cursor and the test harness.
 *
 * The interaction volume follows the camera's view of the tower (C-3, M-4):
 * - Depth is centred on the orbit target, so zooming or orbiting never moves
 *   the tower out of reach. The hand-size depth in [-1, 1] spans
 *   ±DEPTH_RANGE_FRACTION of the camera→target distance.
 * - Image x/y are unprojected through the camera frustum at the hand's depth,
 *   so a landmark appears on screen where it is in the webcam frame, whatever
 *   the screen's aspect ratio, and the hand reaches edge to edge.
 * - The hand is drawn at HAND_SCALE around its pinch point, so the point that
 *   grabs maps exactly while the hand stays in proportion to the blocks.
 */

/** Screen half-extents per half-frame: the middle 1/gain of the webcam frame spans the screen. */
export const FRAME_TO_SCREEN_GAIN = 1.18;
/**
 * The webcam row that maps to the screen's centre row. Above the middle, so
 * pinching near the bottom of the screen still leaves the wrist in frame.
 */
export const FRAME_CENTER_Y = 0.45;
/** Depth half-range as a fraction of the camera→target distance. */
export const DEPTH_RANGE_FRACTION = 0.45;
/** MediaPipe's per-landmark relative z, in units of the volume's height. */
export const LANDMARK_Z_GAIN = 0.4;
/** Hand size relative to its size in the frame, around the pinch point. */
export const HAND_SCALE = 0.6;

const target = new THREE.Vector3(...CAMERA_TARGET);

export interface LandmarkLike {
    x: number;
    y: number;
    z: number;
}

interface Frustum {
    /** Camera→hand distance along the view axis */
    distance: number;
    halfHeight: number;
    halfWidth: number;
}

function frustumAt(camera: THREE.PerspectiveCamera, depth: number): Frustum {
    const targetDistance = camera.position.distanceTo(target);
    const distance = targetDistance * (1 - depth * DEPTH_RANGE_FRACTION);
    const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * FRAME_TO_SCREEN_GAIN;
    return { distance, halfHeight, halfWidth: halfHeight * camera.aspect };
}

const local = new THREE.Vector3();
const inverse = new THREE.Quaternion();

/**
 * Map a normalized landmark to world space. `depth` is the hand-size depth in
 * [-1, 1] from calculateDepth() (+1 nearest the viewer). Writes into `out` when given.
 */
export function landmarkToWorld(
    landmark: LandmarkLike,
    depth: number,
    camera: THREE.PerspectiveCamera,
    out: THREE.Vector3 = new THREE.Vector3(),
): THREE.Vector3 {
    const { distance, halfHeight, halfWidth } = frustumAt(camera, depth);
    local.set(
        (0.5 - landmark.x) * 2 * halfWidth, // the webcam image is mirrored
        (FRAME_CENTER_Y - landmark.y) * 2 * halfHeight,
        -distance - landmark.z * LANDMARK_Z_GAIN * 2 * halfHeight,
    );
    return out.copy(local).applyQuaternion(camera.quaternion).add(camera.position);
}

/**
 * Inverse of landmarkToWorld for a landmark with z = 0: the normalized image
 * position and hand-size depth that put a landmark at `world`.
 */
export function worldToLandmark(world: LandmarkLike, camera: THREE.PerspectiveCamera): { x: number; y: number; depth: number } {
    local.set(world.x, world.y, world.z).sub(camera.position).applyQuaternion(inverse.copy(camera.quaternion).invert());
    const targetDistance = camera.position.distanceTo(target);
    const depth = (1 + local.z / targetDistance) / DEPTH_RANGE_FRACTION;
    const { halfHeight, halfWidth } = frustumAt(camera, depth);
    return {
        x: 0.5 - local.x / (2 * halfWidth),
        y: FRAME_CENTER_Y - local.y / (2 * halfHeight),
        depth,
    };
}

/** The thumb–index midpoint in image space: the point that grabs. */
export function pinchAnchor(landmarks: LandmarkLike[], out: LandmarkLike = { x: 0, y: 0, z: 0 }): LandmarkLike {
    const thumb = landmarks[THUMB_TIP];
    const index = landmarks[INDEX_TIP];
    out.x = (thumb.x + index.x) / 2;
    out.y = (thumb.y + index.y) / 2;
    out.z = (thumb.z + index.z) / 2;
    return out;
}

const anchor: LandmarkLike = { x: 0, y: 0, z: 0 };
const anchorWorld = new THREE.Vector3();

/**
 * Map all 21 landmarks: the pinch point through landmarkToWorld, the rest
 * scaled by HAND_SCALE around it. Writes into `out` (one vector per landmark).
 */
export function handToWorld(
    landmarks: LandmarkLike[],
    depth: number,
    camera: THREE.PerspectiveCamera,
    out: THREE.Vector3[],
): THREE.Vector3[] {
    landmarkToWorld(pinchAnchor(landmarks, anchor), depth, camera, anchorWorld);
    landmarks.forEach((landmark, i) => {
        out[i] ??= new THREE.Vector3();
        landmarkToWorld(landmark, depth, camera, out[i]).sub(anchorWorld).multiplyScalar(HAND_SCALE).add(anchorWorld);
    });
    return out;
}
