import { BLOCK_HALF_EXTENTS, BLOCK_MASS, GRAVITY, PHYSICS_TIMESTEP, TOWER_LEVELS } from '../../src/game/config';
import { createScene, handInput, maxShift } from './scene';
import { add, blockAxis, rebaseline } from './scenarios';

/**
 * How much of the level above each block carries, in block weights: the normal
 * force between it and the blocks one level up, averaged over `seconds` of
 * simulation. A block that touches nothing above is "loose" (C-6).
 */
export async function supportLoads(seed: number, uniformBlocks = false, seconds = 0.5): Promise<Map<string, number>> {
    const scene = await createScene({ seed, uniformBlocks });
    scene.stepFor(1);
    const weight = BLOCK_MASS * Math.hypot(...GRAVITY);
    const total = new Map(scene.blocks.map((b) => [b.id, 0]));
    const steps = Math.round(seconds / PHYSICS_TIMESTEP);
    for (let s = 0; s < steps; s++) {
        scene.step();
        for (const b of scene.blocks) {
            if (b.level === TOWER_LEVELS - 1) continue;
            const below = b.body.collider(0);
            for (const a of scene.blocks) {
                if (a.level !== b.level + 1) continue;
                scene.world.contactPair(below, a.body.collider(0), (manifold) => {
                    for (let i = 0; i < manifold.numContacts(); i++) {
                        total.set(b.id, total.get(b.id)! + manifold.contactImpulse(i) / PHYSICS_TIMESTEP / weight);
                    }
                });
            }
        }
    }
    scene.free();
    return new Map([...total].map(([id, sum]) => [id, sum / steps]));
}

export interface ProbeResult {
    /** How far the block went along its length */
    moved: number;
    /** Largest displacement of any other block */
    disturbed: number;
}

const PROBE_SPEED = 2;
const PROBE_TRAVEL = 2.5;

/**
 * Probe a block the way a player does (C-6): the open hand's fingertip pushes
 * its back end along its length, at 2 units/s for 2.5 units. The fingertip
 * pushes with at most one block's weight (G-3), so it moves a loose block and
 * stalls against a loaded one.
 */
export async function probeBlock(seed: number, id: string, uniformBlocks = false): Promise<ProbeResult> {
    const scene = await createScene({ seed, uniformBlocks });
    scene.stepFor(2);
    rebaseline(scene);
    const block = scene.block(id);
    const axis = blockAxis(block);
    const centre = block.body.translation();
    // The index tip is half the tip gap above the pinch point
    const tipGap = 0.3;
    const start = add({ ...centre, y: centre.y - tipGap / 2 }, axis, -(BLOCK_HALF_EXTENTS[2] + 0.6));
    const back = { x: -axis.x, y: 0, z: -axis.z };
    scene.stepFor(0.5, () => scene.hand.update(handInput(start, false, back, tipGap), PHYSICS_TIMESTEP));
    const steps = Math.round(PROBE_TRAVEL / PROBE_SPEED / PHYSICS_TIMESTEP);
    for (let i = 1; i <= steps; i++) {
        const at = add(start, axis, (PROBE_TRAVEL * i) / steps);
        scene.step(() => scene.hand.update(handInput(at, false, back, tipGap), PHYSICS_TIMESTEP));
    }
    // Hand away, then let the tower settle
    scene.stepFor(1, () => scene.hand.update(handInput(add(start, axis, -4), false, back, tipGap), PHYSICS_TIMESTEP));
    const t = block.body.translation();
    const moved = (t.x - block.spawn.x) * axis.x + (t.z - block.spawn.z) * axis.z;
    const disturbed = maxShift(scene.blocks.filter((b) => b.id !== id));
    scene.free();
    return { moved, disturbed };
}
