import { describe, expect, it } from 'vitest';
import { BLOCKS_PER_LEVEL } from '../../src/game/config';
import { createScene } from './scene';
import { pullBlock, rebaseline } from './scenarios';
import { probeBlock, supportLoads } from './looseBlocks';
import { knownBug } from './knownBug';

const LEVELS = Array.from({ length: 15 }, (_, i) => i + 1);
const SLOTS = Array.from({ length: BLOCKS_PER_LEVEL }, (_, i) => i - 1);

/** Blocks (levels 1–15, two seeds) the fingertip pushes 1+ unit out without moving anything else 0.3 */
async function cleanPushOuts(uniformBlocks: boolean): Promise<number> {
    let n = 0;
    for (const seed of [1, 2]) {
        for (const level of LEVELS) {
            for (const slot of SLOTS) {
                const r = await probeBlock(seed, `${level}-${slot}`, uniformBlocks);
                if (r.moved > 1 && r.disturbed < 0.3) n++;
            }
        }
    }
    return n;
}

/** Levels (0–16) where some block carries less than 5% of what the level carries */
async function levelsWithALooseBlock(seed: number, uniformBlocks: boolean): Promise<number> {
    const loads = await supportLoads(seed, uniformBlocks);
    let n = 0;
    for (let level = 0; level <= 16; level++) {
        const l = SLOTS.map((s) => loads.get(`${level}-${s}`)!);
        const total = l.reduce((a, b) => a + b, 0);
        if (l.some((x) => x < 0.05 * total)) n++;
    }
    return n;
}

// C-6: Jenga's skill is finding the loose blocks. With every block the same
// size, every block carried a third of its level (30–37%) and none could be
// pushed out. With the seeded size variance, some can.
describe('loose blocks [C-6]', () => {
    it('identical blocks: none is loose, and the fingertip pushes none out', async () => {
        expect(await levelsWithALooseBlock(1, true)).toBe(0);
        expect(await cleanPushOuts(true)).toBe(0);
    }, 300_000);

    it('with size variance, several levels have a loose block, and the fingertip pushes some out cleanly', async () => {
        for (const seed of [1, 2, 3]) expect(await levelsWithALooseBlock(seed, false), `seed ${seed}`).toBeGreaterThanOrEqual(5);
        const n = await cleanPushOuts(false);
        console.log(`C-6: the fingertip pushes ${n} of 90 blocks (levels 1-15, seeds 1-2) out cleanly`);
        expect(n).toBeGreaterThanOrEqual(6);
        // Still a game of care: most blocks are held
        expect(n).toBeLessThan(45);
    }, 300_000);

    // G-1's "any block comes out with a careful pull", for the game's tower: every loose one does
    it.each([1, 2, 3])('seed %i: the loose block of every level from 1 to 11 comes out at 4 u/s without disturbing the tower', async (seed) => {
        const failed: string[] = [];
        for (const id of await looseIds(seed, 1, 11)) {
            const r = await carefulPull(seed, id);
            if (!(r.extracted > 7.5 && r.maxShiftAbove < 0.5 && r.fellAbove === 0)) failed.push(`${id} (out ${r.extracted.toFixed(1)}, shift ${r.maxShiftAbove.toFixed(2)})`);
        }
        expect(failed).toEqual([]);
    }, 600_000);

    // Near the top, few levels press on the block above, and a careful pull drags
    // them, loose or not: 0.5–1.3 at 1 g on identical blocks, the inherited 16-0
    // bug below (pull.test.ts). Gravity ×2 (P-2) made level 15 worse (2.1–2.9).
    knownBug('the loose blocks of levels 12 to 15 come out at 4 u/s without disturbing the tower', async () => {
        for (const id of await looseIds(1, 12, 15)) {
            const r = await carefulPull(1, id);
            expect(r.maxShiftAbove, id).toBeLessThan(0.5);
        }
    }, 600_000);
});

async function looseIds(seed: number, from: number, to: number): Promise<string[]> {
    const scene = await createScene({ seed });
    const ids = scene.blocks.filter((b) => b.loose && b.level >= from && b.level <= to).map((b) => b.id);
    scene.free();
    expect(ids).toHaveLength(to - from + 1);
    return ids;
}

async function carefulPull(seed: number, id: string) {
    const scene = await createScene({ seed });
    scene.settle();
    rebaseline(scene);
    const r = pullBlock(scene, id, 4);
    scene.free();
    return r;
}
