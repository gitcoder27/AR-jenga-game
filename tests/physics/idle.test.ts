import { describe, expect, it } from 'vitest';
import { TOWER_BLOCK_COUNT, TOWER_LEVELS } from '../../src/game/config';
import { createScene, maxShift } from './scene';

// P-1 / G-2 / P-2: the resting tower must stay put. Re-run after every physics change.
describe('idle stability', () => {
    it.each([1, 2, 3, 4, 5])('seed %i: all blocks fall asleep and the top drifts < 0.1 in 30 s', async (seed) => {
        const scene = await createScene({ seed });
        scene.stepFor(30);
        const asleep = scene.blocks.filter((b) => b.body.isSleeping()).length;
        const top = scene.blocks.filter((b) => b.level === TOWER_LEVELS - 1);
        expect(asleep).toBe(TOWER_BLOCK_COUNT);
        expect(maxShift(top)).toBeLessThan(0.1);
        scene.free();
    });
});
