import { describe, expect, it } from 'vitest';
import { PHYSICS_TIMESTEP, TOWER_LEVELS } from '../../src/game/config';
import { createScene, handInput, type Scene } from './scene';
import { grabAt, rebaseline } from './scenarios';

const TOP_ID = `${TOWER_LEVELS - 1}-0`;
const UP = { x: 0, y: 1, z: 0 };

/**
 * Grab the centre top block from above and lift it 4 units clear of the tower.
 * Identical blocks (C-6): the lift shoves its neighbours 0.4–0.5 sideways even
 * then, and in this seed's varied tower that tipped the short one off.
 */
async function holdAboveTower(): Promise<{ scene: Scene; carry: { x: number; y: number; z: number } }> {
    const scene = await createScene({ seed: 3, uniformBlocks: true });
    scene.settle();
    const block = scene.block(TOP_ID);
    const p = block.body.translation();
    const pinch = { x: p.x, y: p.y + 0.75 + 0.3, z: p.z };
    expect(grabAt(scene, pinch, UP)).toBe(true);
    const carry = { ...pinch, y: pinch.y + 4 };
    for (let i = 1; i <= 60; i++) {
        const target = { ...pinch, y: pinch.y + (4 * i) / 60 };
        scene.step(() => scene.hand.update(handInput(target, true, UP), PHYSICS_TIMESTEP));
    }
    scene.stepFor(1, () => scene.hand.update(handInput(carry, true, UP), PHYSICS_TIMESTEP));
    rebaseline(scene);
    return { scene, carry };
}

function othersMaxShift(scene: Scene): number {
    return scene.blocks
        .filter((b) => b.id !== TOP_ID)
        .reduce((m, b) => {
            const t = b.body.translation();
            return Math.max(m, Math.hypot(t.x - b.spawn.x, t.y - b.spawn.y, t.z - b.spawn.z));
        }, 0);
}

function speed(scene: Scene, id: string): number {
    const v = scene.block(id).body.linvel();
    return Math.hypot(v.x, v.y, v.z);
}

// H-5: losing tracking while holding must never yank the block through the tower.
describe('tracking loss while holding', () => {
    it('a 3-frame dropout leaves the tower intact and keeps the grab', async () => {
        const { scene, carry } = await holdAboveTower();
        let peak = 0;
        for (let i = 0; i < 3; i++) {
            scene.step(() => scene.hand.update(null, PHYSICS_TIMESTEP));
            peak = Math.max(peak, speed(scene, TOP_ID));
        }
        for (let i = 0; i < 60; i++) {
            scene.step(() => scene.hand.update(handInput(carry, true, UP), PHYSICS_TIMESTEP));
            peak = Math.max(peak, speed(scene, TOP_ID));
        }
        expect(othersMaxShift(scene)).toBeLessThan(0.05);
        expect(peak).toBeLessThan(20);
        expect(scene.hand.heldBody).toBe(scene.block(TOP_ID).body);
        scene.free();
    });

    it('a lasting dropout releases the block, which then falls under gravity only', async () => {
        const { scene } = await holdAboveTower();
        let peak = 0;
        let minY = Infinity;
        for (let i = 0; i < 30; i++) {
            scene.step(() => scene.hand.update(null, PHYSICS_TIMESTEP));
            peak = Math.max(peak, speed(scene, TOP_ID));
            minY = Math.min(minY, scene.block(TOP_ID).body.translation().y);
        }
        expect(scene.hand.heldBody).toBeNull();
        expect(peak).toBeLessThan(20);
        // Still above the tower top after half a second: it fell, it was not dragged.
        expect(minY).toBeGreaterThan(TOWER_LEVELS * 1.5);
        scene.free();
    });
});
