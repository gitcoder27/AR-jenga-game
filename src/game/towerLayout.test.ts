import { describe, expect, it } from 'vitest';
import { BLOCK_HEIGHT, BLOCK_LENGTH, BLOCK_WIDTH, BLOCKS_PER_LEVEL, TOWER_HEIGHT_VARIANCE, TOWER_LEVELS, TOWER_MIN_SHORTFALL, TOWER_WIDTH_VARIANCE } from './config';
import { createRng, generateTowerLayout, levelCenterY, looseBlockId } from './towerLayout';

const layout = (seed: number) => generateTowerLayout(createRng(seed));

describe('tower layout', () => {
    it('is the same tower for the same seed', () => {
        expect(layout(7)).toEqual(layout(7));
        expect(layout(7)).not.toEqual(layout(8));
    });

    describe('block size variance [C-6]', () => {
        it('each level has one loose block, a little short; the other two are full height on the level grid', () => {
            for (const seed of [1, 2, 3]) {
                const blocks = layout(seed);
                for (let level = 0; level < TOWER_LEVELS; level++) {
                    const inLevel = blocks.filter((b) => b.level === level);
                    expect(inLevel).toHaveLength(BLOCKS_PER_LEVEL);
                    const loose = inLevel.filter((b) => b.loose);
                    expect(loose).toHaveLength(1);
                    const shortfall = 1 - loose[0].size[1] / BLOCK_HEIGHT;
                    expect(shortfall).toBeGreaterThanOrEqual(TOWER_HEIGHT_VARIANCE * TOWER_MIN_SHORTFALL - 1e-12);
                    expect(shortfall).toBeLessThanOrEqual(TOWER_HEIGHT_VARIANCE);
                    for (const b of inLevel) {
                        // Every block sits on the level below
                        expect(b.position[1] - b.size[1] / 2).toBeCloseTo(level * BLOCK_HEIGHT, 10);
                        if (!b.loose) expect(b.position[1]).toBeCloseTo(levelCenterY(level), 10);
                        expect(b.size[0]).toBeLessThanOrEqual(BLOCK_WIDTH);
                        expect(b.size[0]).toBeGreaterThanOrEqual(BLOCK_WIDTH * (1 - TOWER_WIDTH_VARIANCE));
                        expect(b.size[2]).toBe(BLOCK_LENGTH);
                    }
                    expect(looseBlockId(blocks, level)).toBe(loose[0].id);
                }
            }
        });

        it('the loose block is in each slot about equally often', () => {
            const counts = [0, 0, 0];
            for (let seed = 1; seed <= 50; seed++) for (const b of layout(seed)) if (b.loose) counts[b.slot + 1]++;
            for (const c of counts) expect(c / (50 * TOWER_LEVELS)).toBeGreaterThan(0.25);
        });
    });
});
