import { describe, expect, it } from 'vitest';
import { BLOCK_HEIGHT, PHYSICS_TIMESTEP, TOWER_LEVELS } from '../../src/game/config';
import { findPlacementSlot, PlacementAssist } from '../../src/game/placement';
import { levelCenterY } from '../../src/game/towerLayout';
import { createScene, maxShift, type Scene } from './scene';
import { extractAndCarryTo, rebaseline, releaseAndLeave } from './scenarios';

const TOP_FACE = TOWER_LEVELS * BLOCK_HEIGHT;

async function settledScene(seed: number): Promise<Scene> {
    const scene = await createScene({ seed });
    scene.stepFor(2);
    rebaseline(scene);
    return scene;
}

/** Yaw about Y folded into [0, π). */
function yawOf(scene: Scene, id: string): number {
    const q = scene.block(id).body.rotation();
    const yaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
    return ((yaw % Math.PI) + Math.PI) % Math.PI;
}

describe('placement assist [C-3, G-6]', () => {
    it('on a full tower the next slot is on a new level, nearest the block', async () => {
        const scene = await settledScene(1);
        const slot = findPlacementSlot(scene.world, { x: 2.5, y: TOP_FACE + 2, z: 0 }, null);
        expect(slot).toMatchObject({ level: TOWER_LEVELS, slot: 1, yaw: 0 });
        expect(slot!.position.y).toBeCloseTo(levelCenterY(TOWER_LEVELS));
        scene.free();
    });

    it('a block from an odd level, let go roughly over the top, is turned and snapped into the slot', async () => {
        const scene = await settledScene(2);
        const assist = new PlacementAssist(scene.world);
        const drive = () => assist.update(scene.hand.heldBody, PHYSICS_TIMESTEP);
        // Level 7 runs along X; level 18 must run along Z. Let go 1 unit off-centre and 2 units high.
        const at = extractAndCarryTo(scene, '7-0', { x: 1, y: TOP_FACE + BLOCK_HEIGHT / 2 + 2, z: 0.6 }, TOP_FACE + 4, drive);
        expect(assist.ghost).toMatchObject({ level: TOWER_LEVELS, slot: 0 });
        const others = scene.blocks.filter((b) => b.id !== '7-0' && b.level > 7);
        rebaseline(scene);
        releaseAndLeave(scene, at, drive);
        scene.stepFor(2, drive);

        const t = scene.block('7-0').body.translation();
        expect(Math.hypot(t.x, t.z)).toBeLessThan(0.1);
        expect(Math.abs(t.y - levelCenterY(TOWER_LEVELS))).toBeLessThan(0.1);
        const yaw = yawOf(scene, '7-0');
        expect(Math.min(yaw, Math.PI - yaw)).toBeLessThan(0.05);
        expect(maxShift(others)).toBeLessThan(0.2);
        scene.free();
    });

    it('far from the top, nothing snaps', async () => {
        const scene = await settledScene(3);
        const assist = new PlacementAssist(scene.world);
        const drive = () => assist.update(scene.hand.heldBody, PHYSICS_TIMESTEP);
        extractAndCarryTo(scene, '8-0', { x: 0, y: TOP_FACE + 2, z: 9 }, TOP_FACE + 4, drive);
        expect(assist.ghost).toBeNull();
        scene.free();
    });
});
