import { describe, expect, it } from 'vitest';
import { knownBug } from './knownBug';
import { BLOCK_LENGTH } from '../../src/game/config';
import { createScene } from './scene';
import { pullBlock, rebaseline } from './scenarios';

const CENTRE = '8-0';
const EDGE = '8-1';

async function pull(id: string, speed: number) {
    const scene = await createScene({ seed: 1 });
    scene.stepFor(2);
    rebaseline(scene);
    const result = pullBlock(scene, id, speed);
    scene.free();
    return result;
}

// G-1 / G-2 (GAME_REVIEW.md sim 6b): careful pulls must not drag the tower.
describe('pulling a level-8 block 9 units along its length', () => {
    knownBug('slow centre pull (6 u/s) shifts the blocks above by < 1 [G-2 friction]', async () => {
        const r = await pull(CENTRE, 6);
        expect(r.grabbed).toBe(true);
        expect(r.maxShiftAbove).toBeLessThan(1);
        expect(r.fellAbove).toBe(0);
    });

    knownBug('slow centre pull (6 u/s) shifts the blocks above by < 0.5 and extracts the block [G-1]', async () => {
        const r = await pull(CENTRE, 6);
        expect(r.maxShiftAbove).toBeLessThan(0.5);
        expect(r.extracted).toBeGreaterThan(BLOCK_LENGTH);
    });

    knownBug('slow edge pull (6 u/s) shifts the blocks above by < 0.5 [G-1]', async () => {
        const r = await pull(EDGE, 6);
        expect(r.maxShiftAbove).toBeLessThan(0.5);
        expect(r.fellAbove).toBe(0);
    });

    it.each([CENTRE, EDGE])('brisk pull (15 u/s) of %s leaves the tower standing', async (id) => {
        const r = await pull(id, 15);
        expect(r.grabbed).toBe(true);
        expect(r.maxShiftAbove).toBeLessThan(0.5);
        expect(r.fellAbove).toBe(0);
    });

    knownBug('a yank (30 u/s) slips out of the fingers instead of being dragged with unlimited force [G-1]', async () => {
        const r = await pull(CENTRE, 30);
        expect(r.grabbed).toBe(true);
        expect(r.stillHeld).toBe(false);
        expect(r.maxShiftAbove).toBeLessThan(0.5);
    });
});
