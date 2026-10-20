import {
    BLOCK_GAP,
    BLOCK_HEIGHT,
    BLOCK_WIDTH,
    TOWER_JITTER_POSITION,
    TOWER_JITTER_ROTATION,
    TOWER_LEVELS,
    type Vec3Tuple,
} from './config';

export interface BlockLayout {
    id: string;
    level: number;
    /** Position in the level: -1, 0 or 1 */
    slot: number;
    position: Vec3Tuple;
    rotation: Vec3Tuple;
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
            });
        }
    }
    return items;
}
