import { describe, expect, it } from 'vitest';
import { BLOCK_HALF_EXTENTS, PHYSICS_TIMESTEP } from '../../src/game/config';
import type { Vec3 } from '../../src/game/grab';
import { createScene, distance, handInput, type Scene } from './scene';
import { rebaseline } from './scenarios';

async function settledScene(): Promise<Scene> {
    const scene = await createScene({ seed: 1 });
    scene.stepFor(2);
    rebaseline(scene);
    return scene;
}

/** Move an open (not pinching) hand from `from` to `to` at `speed` u/s, the other joints trailing along `back`. */
function sweep(scene: Scene, from: Vec3, to: Vec3, speed: number, back: Vec3): void {
    const steps = Math.max(1, Math.round((distance(from, to) / speed) * 60));
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const at = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t };
        scene.step(() => scene.hand.update(handInput(at, false, back), PHYSICS_TIMESTEP));
    }
    scene.stepFor(1.5, () => scene.hand.update(handInput(to, false, back), PHYSICS_TIMESTEP));
}

const shifts = (scene: Scene) => new Map(scene.blocks.map((b) => [b.id, distance(b.body.translation(), b.spawn)]));
const maxShiftExcept = (scene: Scene, id?: string) => Math.max(...[...shifts(scene)].filter(([k]) => k !== id).map(([, d]) => d));

// G-3 (GAME_REVIEW.md sim 8): only the index fingertip touches blocks, and it pushes like a finger.
describe('hand colliders [G-3]', () => {
    it('brushing past the tower face with the palm and fingers overlapping it displaces nothing by > 0.3', async () => {
        const scene = await settledScene();
        const face = BLOCK_HALF_EXTENTS[2];
        const y = scene.block('8-0').body.translation().y;
        // The fingertip 0.6 clear of the front face; the rest of the hand trails into the tower
        sweep(scene, { x: -8, y, z: face + 0.6 }, { x: 8, y, z: face + 0.6 }, 6, { x: 0, y: 0, z: -1 });
        expect(maxShiftExcept(scene)).toBeLessThan(0.3);
        scene.free();
    });

    it('a deliberate poke moves only the poked block', async () => {
        const scene = await settledScene();
        // 17-1 runs along X on the top level: poke its +X end 1.5 units inwards
        const b = scene.block('17-1').body.translation();
        const end = b.x + BLOCK_HALF_EXTENTS[2];
        sweep(scene, { x: end + 1, y: b.y, z: b.z }, { x: end - 1.5, y: b.y, z: b.z }, 2, { x: 1, y: 0, z: 0 });
        expect(shifts(scene).get('17-1')).toBeGreaterThan(1);
        expect(maxShiftExcept(scene, '17-1')).toBeLessThan(0.3);
        scene.free();
    });

    it('a 60 u/s swipe through the top level moves no block by more than 1 unit', async () => {
        const scene = await settledScene();
        const y = scene.block('17-0').body.translation().y;
        sweep(scene, { x: 1, y, z: 8 }, { x: 1, y, z: -8 }, 60, { x: 0, y: 0, z: 1 });
        expect(maxShiftExcept(scene)).toBeLessThan(1);
        scene.free();
    });

    it('poking a loaded block does not shove the tower', async () => {
        const scene = await settledScene();
        const b = scene.block('8-0').body.translation();
        const end = b.z + BLOCK_HALF_EXTENTS[2];
        sweep(scene, { x: b.x, y: b.y, z: end + 1 }, { x: b.x, y: b.y, z: end - 1.5 }, 2, { x: 0, y: 0, z: 1 });
        expect(maxShiftExcept(scene, '8-0')).toBeLessThan(0.3);
        scene.free();
    });
});
