import {
    BLOCK_GAP,
    BLOCK_HEIGHT,
    BLOCK_LENGTH,
    BLOCK_WIDTH,
    BLOCKS_PER_LEVEL,
    TOWER_HEIGHT_VARIANCE,
    TOWER_MIN_SHORTFALL,
    TOWER_JITTER_POSITION,
    TOWER_JITTER_ROTATION,
    TOWER_LEVELS,
    TOWER_WIDTH_VARIANCE,
    type Vec3Tuple,
} from './config';

export interface BlockLayout {
    id: string;
    level: number;
    /** Position in the level: -1, 0 or 1 */
    slot: number;
    position: Vec3Tuple;
    rotation: Vec3Tuple;
    /** Full width, height and length (C-6: each a little different) */
    size: Vec3Tuple;
    /** The level's short block (C-6): it carries little or nothing */
    loose: boolean;
}

/**
 * Lightness offset (−0.1…0.1) for a block's wood shade, from the tower seed and
 * the block id. A hash rather than another draw from the layout RNG, so towers
 * keep the same geometry for a given seed.
 */
export function blockShade(seed: number, id: string): number {
    let h = seed >>> 0;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x9e3779b1);
    return (createRng(h)() - 0.5) * 0.2;
}

/** Small deterministic PRNG (mulberry32) so towers are reproducible from a seed. */
export function createRng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Even levels run along Z, odd levels are rotated 90° and run along X. */
export function isLevelRotated(level: number): boolean {
    return level % 2 !== 0;
}

export function levelCenterY(level: number): number {
    return level * BLOCK_HEIGHT + BLOCK_HEIGHT / 2;
}

/** Id of `level`'s loose block in a layout (C-6) */
export function looseBlockId(layout: BlockLayout[], level: number): string {
    const block = layout.find((b) => b.level === level && b.loose);
    if (!block) throw new Error(`no loose block in level ${level}`);
    return block.id;
}

export function generateTowerLayout(random: () => number = Math.random): BlockLayout[] {
    const items: BlockLayout[] = [];
    const spacing = BLOCK_WIDTH + BLOCK_GAP;

    for (let level = 0; level < TOWER_LEVELS; level++) {
        const y = levelCenterY(level);

        for (let slot = -1; slot <= 1; slot++) {
            const pos = slot * spacing;
            const jx = (random() - 0.5) * TOWER_JITTER_POSITION;
            const jz = (random() - 0.5) * TOWER_JITTER_POSITION;
            const jr = (random() - 0.5) * TOWER_JITTER_ROTATION;

            const rotated = isLevelRotated(level);
            items.push({
                id: `${level}-${slot}`,
                level,
                slot,
                position: rotated ? [jx, y, pos + jz] : [pos + jx, y, jz],
                rotation: rotated ? [0, Math.PI / 2 + jr, 0] : [0, jr, 0],
                size: [BLOCK_WIDTH, BLOCK_HEIGHT, BLOCK_LENGTH],
                loose: false,
            });
        }
    }

    // Sizes (C-6), drawn after the positions so a seed's jitter is what it was
    // before the variance. In each level one block, in a random slot, is a
    // little short: it rests on the level below under a gap, and carries little
    // or nothing. The other two are full height on the level grid, so the level
    // above rests on two blocks and can't tip (with only one, the tower leaned).
    for (let level = 0; level < TOWER_LEVELS; level++) {
        const blocks = items.slice(level * BLOCKS_PER_LEVEL, (level + 1) * BLOCKS_PER_LEVEL);
        const short = Math.floor(random() * BLOCKS_PER_LEVEL);
        const shortfall = TOWER_HEIGHT_VARIANCE * (TOWER_MIN_SHORTFALL + (1 - TOWER_MIN_SHORTFALL) * random());
        blocks.forEach((b, i) => {
            const height = BLOCK_HEIGHT * (i === short ? 1 - shortfall : 1);
            b.size = [BLOCK_WIDTH * (1 - random() * TOWER_WIDTH_VARIANCE), height, BLOCK_LENGTH];
            b.position[1] = level * BLOCK_HEIGHT + height / 2;
            b.loose = i === short;
        });
    }
    return items;
}
