import { describe, expect, it } from 'vitest';
import { BLOCK_HALF_EXTENTS, PHYSICS_TIMESTEP } from '../../src/game/config';
import { createScene, handInput, type Scene } from './scene';
import { blockAxis, frontPinchPoint, grabAt } from './scenarios';
import type { Vec3 } from '../../src/game/grab';

// F-3: the depth cue marks where the pinch point is above the surface below it.
describe('drop point under the pinch', () => {
    const UP = { x: 0, y: 0, z: -1 };

    /** Fresh settled tower with an open hand held at `at` (it appears there: no sweep through the tower). */
    async function handAt(at: Vec3): Promise<Scene> {
        const scene = await createScene({ seed: 1 });
        scene.stepFor(1);
        scene.stepFor(0.1, () => scene.hand.update(handInput(at, false, UP), PHYSICS_TIMESTEP));
        return scene;
    }

    it('lands on the table beside the tower', async () => {
        const scene = await handAt({ x: 4, y: 3, z: 4 });
        expect(scene.hand.dropPoint!.y).toBeCloseTo(0, 1); // table top
        scene.free();
    });

    it('lands on the top block above the tower', async () => {
        const probe = await createScene({ seed: 1 });
        probe.stepFor(1);
        const top = Math.max(...probe.blocks.map((b) => b.body.translation().y)) + BLOCK_HALF_EXTENTS[1];
        probe.free();

        const scene = await handAt({ x: 0, y: top + 5, z: 0 });
        expect(scene.hand.dropPoint!.y).toBeCloseTo(top, 1);
        scene.free();
    });

    it('passes through the carried block to the surface below it', async () => {
        const scene = await createScene({ seed: 1 });
        scene.stepFor(1);
        const block = scene.block('5-0');
        const axis = blockAxis(block);
        const pinch = frontPinchPoint(block);
        expect(grabAt(scene, pinch, axis)).toBe(true);
        expect(scene.hand.dropPoint!.y).toBeLessThan(block.body.translation().y - BLOCK_HALF_EXTENTS[1]);
        scene.free();
    });
});
