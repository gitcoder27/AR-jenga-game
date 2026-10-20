/** Scripted interactions reused across the physics regression tests. */
import { BLOCK_HALF_EXTENTS } from '../../src/game/config';
import type { Vec3 } from '../../src/game/grab';
import { handInput, type Scene, type SceneBlock } from './scene';

const PINCH_STANDOFF = 0.3;

/** World-space unit vector along a block's long axis (its local +Z). */
export function blockAxis(block: SceneBlock): Vec3 {
    const q = block.body.rotation();
    // Rotate (0,0,1) by q
    return {
        x: 2 * (q.x * q.z + q.w * q.y),
        y: 2 * (q.y * q.z - q.w * q.x),
        z: 1 - 2 * (q.x * q.x + q.y * q.y),
    };
}

export function add(a: Vec3, b: Vec3, s = 1): Vec3 {
    return { x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s };
}

/** Pinch point just outside the block's front end face (the +axis end). */
export function frontPinchPoint(block: SceneBlock): Vec3 {
    return add(block.body.translation(), blockAxis(block), BLOCK_HALF_EXTENTS[2] + PINCH_STANDOFF);
}

/** Record the current pose of every block as its reference ("spawn") pose. */
export function rebaseline(scene: Scene): void {
    for (const b of scene.blocks) b.spawn = { ...b.body.translation() };
}

/** Bring the hand to `pinch` open, then close it for a few frames. Returns true if the block was grabbed. */
export function grabAt(scene: Scene, pinch: Vec3, back: Vec3, settleFrames = 10, pinchFrames = 10): boolean {
    for (let i = 0; i < settleFrames; i++) scene.step(() => scene.hand.update(handInput(pinch, false, back)));
    for (let i = 0; i < pinchFrames; i++) scene.step(() => scene.hand.update(handInput(pinch, true, back)));
    return scene.hand.heldBody !== null;
}

export interface PullResult {
    grabbed: boolean;
    /** Distance the pulled block travelled along its axis */
    extracted: number;
    /** Largest displacement of any block above the pulled level */
    maxShiftAbove: number;
    /** Blocks above that dropped by more than half a block height */
    fellAbove: number;
    /** Whether the hand still holds the block at the end */
    stillHeld: boolean;
}

/**
 * Grab a block by its front face and pull it `distance` units along its long
 * axis at a constant hand speed, then hold for `holdSeconds`.
 */
export function pullBlock(scene: Scene, id: string, speed: number, distance = 9, holdSeconds = 2): PullResult {
    const block = scene.block(id);
    const axis = blockAxis(block);
    const start = { ...block.body.translation() };
    const pinch = frontPinchPoint(block);
    const grabbed = grabAt(scene, pinch, axis);

    const steps = Math.max(1, Math.round((distance / speed) * 60));
    for (let i = 1; i <= steps; i++) {
        const target = add(pinch, axis, (distance * i) / steps);
        scene.step(() => scene.hand.update(handInput(target, true, axis)));
    }
    const end = add(pinch, axis, distance);
    scene.stepFor(holdSeconds, () => scene.hand.update(handInput(end, true, axis)));

    const p = block.body.translation();
    const extracted = (p.x - start.x) * axis.x + (p.y - start.y) * axis.y + (p.z - start.z) * axis.z;
    const above = scene.blocks.filter((b) => b.level > block.level);
    const halfHeight = BLOCK_HALF_EXTENTS[1];
    return {
        grabbed,
        extracted,
        maxShiftAbove: above.reduce((m, b) => Math.max(m, Math.hypot(
            b.body.translation().x - b.spawn.x, b.body.translation().y - b.spawn.y, b.body.translation().z - b.spawn.z)), 0),
        fellAbove: above.filter((b) => b.spawn.y - b.body.translation().y > halfHeight).length,
        stillHeld: scene.hand.heldBody === block.body,
    };
}
