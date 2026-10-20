import { BLOCK_HALF_EXTENTS } from '../../src/game/config';
import type { Vec3 } from '../../src/game/grab';
import type { SceneBlock } from './scene';

/** Exact distance from a point to a block's oriented box (0 inside). Independent of Rapier queries. */
export function distanceToBlock(point: Vec3, block: SceneBlock): number {
    const t = block.body.translation();
    const q = block.body.rotation();
    // Rotate (point - t) by the inverse rotation
    const px = point.x - t.x, py = point.y - t.y, pz = point.z - t.z;
    const ix = -q.x, iy = -q.y, iz = -q.z, w = q.w;
    // v' = v + 2w(u×v) + 2u×(u×v), u = (ix,iy,iz)
    const cx = iy * pz - iz * py, cy = iz * px - ix * pz, cz = ix * py - iy * px;
    const lx = px + 2 * (w * cx + (iy * cz - iz * cy));
    const ly = py + 2 * (w * cy + (iz * cx - ix * cz));
    const lz = pz + 2 * (w * cz + (ix * cy - iy * cx));
    const dx = Math.max(Math.abs(lx) - BLOCK_HALF_EXTENTS[0], 0);
    const dy = Math.max(Math.abs(ly) - BLOCK_HALF_EXTENTS[1], 0);
    const dz = Math.max(Math.abs(lz) - BLOCK_HALF_EXTENTS[2], 0);
    return Math.hypot(dx, dy, dz);
}

export function nearestBlock(point: Vec3, blocks: SceneBlock[]): { block: SceneBlock; distance: number } {
    let best = { block: blocks[0], distance: Infinity };
    for (const block of blocks) {
        const d = distanceToBlock(point, block);
        if (d < best.distance) best = { block, distance: d };
    }
    return best;
}
