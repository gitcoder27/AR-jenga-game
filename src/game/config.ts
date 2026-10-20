/**
 * Single source of truth for world geometry and physics tuning.
 *
 * Components and the headless physics tests (tests/physics) both read these,
 * so a tuning change is exercised by the regression suite automatically.
 */

export type Vec3Tuple = [number, number, number];

// Block dimensions (world units). A real block is 7.5 cm long, so the world is ~100x scale.
export const BLOCK_WIDTH = 2.5;
export const BLOCK_HEIGHT = 1.5;
export const BLOCK_LENGTH = 7.5;
export const BLOCK_HALF_EXTENTS: Vec3Tuple = [BLOCK_WIDTH / 2, BLOCK_HEIGHT / 2, BLOCK_LENGTH / 2];

export const TOWER_LEVELS = 18;
export const BLOCKS_PER_LEVEL = 3;
export const TOWER_BLOCK_COUNT = TOWER_LEVELS * BLOCKS_PER_LEVEL;
export const BLOCK_GAP = 0.05;
export const TOWER_JITTER_POSITION = 0.05;
export const TOWER_JITTER_ROTATION = 0.02;

export const GRAVITY: Vec3Tuple = [0, -9.81, 0];
export const PHYSICS_TIMESTEP = 1 / 60;

export const BLOCK_FRICTION = 1;
export const TABLE_FRICTION = 1;
export const FLOOR_FRICTION = 1;
export const RESTITUTION = 0;

export const TABLE_HALF_EXTENTS: Vec3Tuple = [5, 1, 5];
export const TABLE_POSITION: Vec3Tuple = [0, -1, 0];
export const FLOOR_HALF_EXTENTS: Vec3Tuple = [50, 0.5, 50];
export const FLOOR_POSITION: Vec3Tuple = [0, -5, 0];

// Camera. The hand's reach is fixed relative to the camera (12–28 units, C-3),
// so zoom and orbit are limited to keep the tower reachable and above the table (V-2).
export const CAMERA_POSITION: Vec3Tuple = [0, 10, 20];
export const CAMERA_TARGET: Vec3Tuple = [0, 0, 0];
export const CAMERA_MIN_DISTANCE = 18;
export const CAMERA_MAX_DISTANCE = 28;
export const CAMERA_MIN_POLAR_ANGLE = (15 * Math.PI) / 180;
export const CAMERA_MAX_POLAR_ANGLE = (80 * Math.PI) / 180;

// Hand / grab
export const HAND_JOINT_COUNT = 21;
export const HAND_JOINT_RADIUS = 0.05;
export const HAND_PARKING_POSITION: Vec3Tuple = [0, -100, 0];
export const GRAB_RADIUS = 0.5;
export const HELD_BLOCK_DAMPING = 2;
/** A pinch only grabs within this long of closing; pinching in the air never grabs later (G-4). */
export const GRAB_ONSET_WINDOW_S = 0.15;
/** Hold the hand still this long after tracking drops out before letting go (H-5). */
export const TRACKING_LOSS_GRACE_S = 0.25;

/** Blocks below this height have fallen out of the world and are culled (P-5). */
export const KILL_PLANE_Y = -10;

export const THUMB_TIP = 4;
export const INDEX_TIP = 8;
