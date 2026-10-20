import { describe, expect, it } from 'vitest';
import { BLOCK_HALF_EXTENTS, PHYSICS_TIMESTEP } from '../../src/game/config';
import type { Vec3 } from '../../src/game/grab';
import { createScene, distance, handInput, type Scene } from './scene';
import { blockAxis, frontPinchPoint, grabAt, rebaseline } from './scenarios';

async function settledScene(): Promise<Scene> {
    const scene = await createScene({ seed: 1 });
    scene.settle();
    rebaseline(scene);
    return scene;
}

const frame = (scene: Scene, at: Vec3, pinching: boolean, back: Vec3, camera: boolean) =>
    scene.step(() => scene.hand.update({ ...handInput(at, pinching, back), inert: camera }, PHYSICS_TIMESTEP));

// H-2: while the hand turns the view, it touches and grabs nothing.
describe('camera mode [H-2]', () => {
    it('the poke that moves a loose block moves nothing in camera mode', async () => {
        const scene = await settledScene();
        const b = scene.block('17-1').body.translation();
        const end = b.x + BLOCK_HALF_EXTENTS[2];
        const from = { x: end + 1, y: b.y, z: b.z }, to = { x: end - 1.5, y: b.y, z: b.z };
        for (let i = 0; i <= 75; i++) {
            const t = i / 75;
            frame(scene, { x: from.x + (to.x - from.x) * t, y: from.y, z: from.z }, false, { x: 1, y: 0, z: 0 }, true);
        }
        for (let i = 0; i < 60; i++) frame(scene, to, false, { x: 1, y: 0, z: 0 }, true);
        // The same poke outside camera mode moves 17-1 by > 1 (fingertip.test.ts)
        expect(Math.max(...scene.blocks.map((x) => distance(x.body.translation(), x.spawn)))).toBeLessThan(0.05);
        scene.free();
    });

    it('a pinch in camera mode, or the pinch that ends it, grabs nothing; the next pinch after reopening does', async () => {
        const scene = await settledScene();
        const block = scene.block('2-0');
        const pinch = frontPinchPoint(block);
        const back = blockAxis(block);
        for (let i = 0; i < 10; i++) frame(scene, pinch, false, back, true);
        for (let i = 0; i < 10; i++) frame(scene, pinch, true, back, true);
        expect(scene.hand.heldBody).toBeNull();
        // Camera mode ends at that pinch: still pinched, so still nothing
        for (let i = 0; i < 20; i++) frame(scene, pinch, true, back, false);
        expect(scene.hand.heldBody).toBeNull();
        expect(grabAt(scene, pinch, back)).toBe(true);
        scene.free();
    });
});
