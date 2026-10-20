import { describe, expect, it } from 'vitest';
import { TOWER_BLOCK_COUNT, TOWER_LEVELS } from '../../src/game/config';
import { createScene, maxShift } from './scene';
import { rebaseline } from './scenarios';

/** How long a new tower takes to come to rest */
const SETTLE_S = 4;

// P-1 / G-2 / P-2 / C-6: the resting tower must stay put. Re-run after every physics change.
//
// Since C-6 a new tower first settles by design: a level resting on its tallest
// block(s) drops onto them, and the levels above lean a little. So the
// settling and the creep are checked apart: the settled tower stands close to
// its layout, then doesn't move at all.
describe('idle stability', () => {
    it.each([1, 2, 3, 4, 5])('seed %i: settles within 0.3 of its layout, then all blocks sleep and the top creeps < 0.1 in 30 s', async (seed) => {
        const scene = await createScene({ seed });
        const top = scene.blocks.filter((b) => b.level === TOWER_LEVELS - 1);
        scene.stepFor(SETTLE_S);
        expect(maxShift(top), 'settling').toBeLessThan(0.3);
        rebaseline(scene);
        scene.stepFor(30);
        const asleep = scene.blocks.filter((b) => b.body.isSleeping()).length;
        expect(asleep).toBe(TOWER_BLOCK_COUNT);
        expect(maxShift(top), 'creep').toBeLessThan(0.1);
        scene.free();
    });
});
