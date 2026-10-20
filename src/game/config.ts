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
/** Half-extent of the tower's square footprint */
export const TOWER_FOOTPRINT = 1.5 * BLOCK_WIDTH + BLOCK_GAP;
export const TOWER_JITTER_POSITION = 0.05;
export const TOWER_JITTER_ROTATION = 0.02;
/*
 * Block size variance (C-6). Real blocks differ by fractions of a millimetre,
 * so some carry the level above and some are loose: finding those is the game.
 * In each level one block is short by up to this fraction of its height; the
 * other two are exactly BLOCK_HEIGHT, which keeps the level grid. Seeded with
 * the tower, so a seed is always the same tower.
 */
export const TOWER_HEIGHT_VARIANCE = 0.005;
/** …and by at least this share of it: less is taken up by contact compression, and it isn't loose */
export const TOWER_MIN_SHORTFALL = 0.25;
export const TOWER_WIDTH_VARIANCE = 0.01;

/*
 * Gravity ×2 (P-2). The world is ~100× real scale, so under real gravity the
 * tower fell like a 27 m structure, in slow motion. ×2.5 broke the idle and
 * tracking-loss suites; ×2 passes them (DECISIONS.md).
 */
export const GRAVITY_SCALE = 2;
export const GRAVITY: Vec3Tuple = [0, -9.81 * GRAVITY_SCALE, 0];
export const PHYSICS_TIMESTEP = 1 / 60;
/*
 * Contact stiffness (Hz; @react-three/rapier's default is 30). Rapier's soft
 * contacts sink in proportion to the load. Under twice the gravity, a level
 * carried unevenly (one loose block, C-6) tilted, and the tilts added up to a
 * visible lean. 60 halves the sink at the same solver cost; above it, with 4
 * solver iterations, the tower jitters.
 */
export const CONTACT_NATURAL_FREQUENCY = 60;

/*
 * Contact friction (G-2). Wood on wood is about 0.3–0.5; with 1.0, pulling a
 * block dragged its neighbours. Rapier's default combine rule averages the two
 * colliders' coefficients, so the per-collider values are derived from the
 * intended contact values.
 */
export const BLOCK_BLOCK_FRICTION = 0.45;
export const BLOCK_TABLE_FRICTION = 0.6;
export const BLOCK_FRICTION = BLOCK_BLOCK_FRICTION;
export const TABLE_FRICTION = 2 * BLOCK_TABLE_FRICTION - BLOCK_FRICTION;
export const FLOOR_FRICTION = TABLE_FRICTION;
export const RESTITUTION = 0;

export const TABLE_HALF_EXTENTS: Vec3Tuple = [5, 1, 5];
export const TABLE_POSITION: Vec3Tuple = [0, -1, 0];
export const FLOOR_HALF_EXTENTS: Vec3Tuple = [50, 0.5, 50];
export const FLOOR_POSITION: Vec3Tuple = [0, -5, 0];

// Camera (C-3, V-1, V-2). The orbit target is the middle of the tower plus
// headroom for placing on top, and the hand's reach is centred on it
// (tracking/mapping.ts), so every allowed orbit and zoom keeps the whole tower
// on screen and within reach (src/tracking/mapping.test.ts sweeps this).
export const CAMERA_FOV = 50;
export const CAMERA_TARGET: Vec3Tuple = [0, 14, 0];
/** Default view: 40 units from the target, 20° above horizontal. */
export const CAMERA_POSITION: Vec3Tuple = [0, 14 + 40 * Math.cos((70 * Math.PI) / 180), 40 * Math.sin((70 * Math.PI) / 180)];
export const CAMERA_MIN_DISTANCE = 36;
export const CAMERA_MAX_DISTANCE = 48;
export const CAMERA_MIN_POLAR_ANGLE = (15 * Math.PI) / 180;
export const CAMERA_MAX_POLAR_ANGLE = (80 * Math.PI) / 180;

// Camera mode (H-2): deliberate and clutched
/**
 * An open palm held this still (normalized image units, palm centre) ...
 * A palm moving faster than about STILL / HOLD (0.04 frames/s) never arms;
 * filtered landmark jitter at rest is ~0.002. Unplaytested: real hands may need more.
 */
export const CAMERA_CLUTCH_STILL = 0.015;
/** ... for this long (ms) enters camera mode */
export const CAMERA_CLUTCH_HOLD_MS = 400;
/** Orbit radians per frame width of palm motion (was 15) */
export const CAMERA_ORBIT_SENSITIVITY = 5;
/** Palm motion within this band (normalized image units) doesn't turn the view */
export const CAMERA_ORBIT_DEADZONE = 0.01;
/** Time constant (s) of the orbit's smoothing */
export const CAMERA_ORBIT_SMOOTHING_S = 0.08;

// Depth calibration (H-4): hand near, then far, for this long each (ms)
export const CALIBRATION_PHASE_MS = 2500;
/** Hand sizes are sampled over the last part of each phase, once the hand has got there */
export const CALIBRATION_SAMPLE_MS = 1000;
export const CALIBRATION_MIN_SAMPLES = 5;
/** Near must look at least this many times bigger than far */
export const CALIBRATION_MIN_RATIO = 1.4;

// Hand / grab
export const HAND_JOINT_COUNT = 21;
export const HAND_PARKING_POSITION: Vec3Tuple = [0, -100, 0];
/** Blocks use Rapier's default density 1 (P-3), so a block's mass is its volume. */
export const BLOCK_MASS = BLOCK_WIDTH * BLOCK_HEIGHT * BLOCK_LENGTH;
/*
 * The index fingertip (G-3): the only part of the hand that pushes. A capsule
 * driven by a velocity target with speed and force caps.
 */
export const FINGERTIP_RADIUS = 0.25;
/** Half the length of the capsule's straight part, along the finger */
export const FINGERTIP_HALF_LENGTH = 0.2;
export const FINGERTIP_MASS = 1;
/** Fastest the fingertip moves, whatever the tracking does (units/s) */
export const FINGERTIP_MAX_SPEED = 10;
/** Hardest it pushes: one block's weight. Moves a loose block, not a loaded one. */
export const FINGERTIP_MAX_FORCE = BLOCK_MASS * Math.hypot(...GRAVITY);
/** It aims to close the gap to the tracked tip in this long */
export const FINGERTIP_RESPONSE_S = 0.05;
/** Further behind than this (blocked, or the hand jumped), it teleports with its collider off */
export const FINGERTIP_SNAP_DISTANCE = 1.5;
/** A disabled fingertip collider comes back only once it is this far clear of every block */
export const FINGERTIP_CLEARANCE = 0.15;
export const GRAB_RADIUS = 0.5;
/*
 * Soft grab (G-1): a proxy at the pinch point, fixed to the block, chased by a
 * critically damped PD controller with a force cap, so a block held fast by the
 * tower slips out of the fingers instead of dragging the tower along.
 */
/** Natural frequency of the position controller (Hz) */
export const GRAB_FREQUENCY = 6;
/** Natural frequency of the orientation controller (Hz) */
export const GRAB_ANGULAR_FREQUENCY = 4;
/** Force cap, as an acceleration of the held block in g (holding its weight up included) */
export const GRAB_MAX_ACCELERATION = 20;
/**
 * The block slips out when it falls this far behind the pinch point while it is
 * being drawn out of the tower: a yank loses the block instead of dragging the tower.
 */
export const GRAB_SLIP_DISTANCE = 1.5;
/** …and this far once it is out, so a brisk carry at a low frame rate doesn't drop it. */
export const GRAB_CARRY_SLIP_DISTANCE = 3;
/** …for this long: a jump of the hand from a dropped camera frame is caught up before it slips */
export const GRAB_SLIP_TIME = 0.15;
/** Mass of the proxy "fingertip" body */
export const GRAB_PROXY_MASS = 1;
/** A pinch only grabs within this long of closing; pinching in the air never grabs later (G-4). */
export const GRAB_ONSET_WINDOW_S = 0.15;
/** Hold the hand still this long after tracking drops out before letting go (H-5). */
export const TRACKING_LOSS_GRACE_S = 0.25;

/** Blocks below this height have fallen out of the world and are culled (P-5). */
export const KILL_PLANE_Y = -10;

export const THUMB_TIP = 4;
export const INDEX_DIP = 7;
export const INDEX_TIP = 8;
