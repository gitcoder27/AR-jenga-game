import { describe, expect, it } from 'vitest';
import { BLOCK_HALF_EXTENTS, PHYSICS_TIMESTEP } from '../../src/game/config';
import type { Vec3 } from '../../src/game/grab';
import { createScene, distance, handInput, type Scene } from './scene';
import { blockAxis, frontPinchPoint, rebaseline } from './scenarios';

const FRAME_RATES = [30, 60, 120];

// Identical blocks (C-6): the extraction is of a fixed block, which in the
// game's tower may be one of the tight ones
async function settledScene(): Promise<Scene> {
    const scene = await createScene({ seed: 1, uniformBlocks: true });
    scene.settle();
    rebaseline(scene);
    return scene;
}

/**
 * Run `seconds` of physics with the hand tracked at `fps`: hand.update() gets a
 * new sample of `path` once per render frame, as in the app, where the fixed
 * 60 Hz physics steps run 0, 1 or 2 times per frame. `onStep(t)` runs after each step,
 * with t the time since the drive began.
 */
function drive(scene: Scene, path: (t: number) => Vec3, pinching: (t: number) => boolean, back: Vec3, fps: number, seconds: number, onStep?: (t: number) => void) {
    const frame = 1 / fps;
    let nextFrame = 0;
    for (let step = 0; step < Math.round(seconds / PHYSICS_TIMESTEP); step++) {
        const t = step * PHYSICS_TIMESTEP;
        while (nextFrame <= t + 1e-9) {
            scene.hand.update(handInput(path(nextFrame), pinching(nextFrame), back), frame);
            nextFrame += frame;
        }
        scene.step();
        onStep?.(t + PHYSICS_TIMESTEP);
    }
}

const lerpPath = (from: Vec3, to: Vec3, start: number, duration: number) => (t: number): Vec3 => {
    const k = Math.min(1, Math.max(0, (t - start) / duration));
    return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, z: from.z + (to.z - from.z) * k };
};

// P-4: hand targets follow the physics steps, not the render frames.
describe('hand motion is the same at any frame rate [P-4]', () => {
    it('the fingertip moves at an even speed through free space', async () => {
        for (const fps of FRAME_RATES) {
            const scene = await settledScene();
            const path = lerpPath({ x: 10, y: 5, z: 10 }, { x: 10, y: 5, z: -10 }, 0.5, 4); // 5 u/s, away from the tower
            const speeds: number[] = [];
            drive(scene, path, () => false, { x: 0, y: 0, z: 1 }, fps, 4, (t) => {
                const v = scene.hand.fingertipBody!.linvel();
                // The cruise: the path starts at 0.5 s and the tip has caught up well before 1.5 s
                if (t > 1.5 && t < 4) speeds.push(Math.hypot(v.x, v.y, v.z));
            });
            const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
            const sd = Math.sqrt(speeds.reduce((a, b) => a + (b - mean) ** 2, 0) / speeds.length);
            console.log(`P-4 fingertip speed at ${fps} fps: mean ${mean.toFixed(2)}, sd ${sd.toFixed(2)}`);
            expect(sd / mean).toBeLessThan(0.1);
            scene.free();
        }
    });

    it('a poke moves the loose block the same distance at 30, 60 and 120 fps', async () => {
        const moved: number[] = [];
        for (const fps of FRAME_RATES) {
            const scene = await settledScene();
            const b = scene.block('17-1').body.translation();
            const end = b.x + BLOCK_HALF_EXTENTS[2];
            drive(scene, lerpPath({ x: end + 1, y: b.y, z: b.z }, { x: end - 1.5, y: b.y, z: b.z }, 0.3, 1.25), () => false, { x: 1, y: 0, z: 0 }, fps, 3);
            moved.push(distance(scene.block('17-1').body.translation(), scene.block('17-1').spawn));
            scene.free();
        }
        console.log(`P-4 poke: 17-1 moved ${moved.map((m) => m.toFixed(2)).join(' / ')} at ${FRAME_RATES.join(' / ')} fps`);
        expect(Math.max(...moved) - Math.min(...moved)).toBeLessThan(0.25);
    });

    it('a careful extraction ends the same at 30, 60 and 120 fps', async () => {
        const out: number[] = [];
        const shifts: number[] = [];
        for (const fps of FRAME_RATES) {
            const scene = await settledScene();
            const block = scene.block('2-0');
            const axis = blockAxis(block);
            const pinch = frontPinchPoint(block);
            const target = { x: pinch.x + axis.x * 6, y: pinch.y + axis.y * 6, z: pinch.z + axis.z * 6 };
            drive(scene, lerpPath(pinch, target, 0.5, 1.5), (t) => t > 0.3, axis, fps, 3.5);
            const p = block.body.translation();
            out.push((p.x - block.spawn.x) * axis.x + (p.y - block.spawn.y) * axis.y + (p.z - block.spawn.z) * axis.z);
            shifts.push(Math.max(...scene.blocks.filter((b) => b.id !== '2-0').map((b) => distance(b.body.translation(), b.spawn))));
            scene.free();
        }
        console.log(`P-4 extraction: 2-0 out ${out.map((m) => m.toFixed(2)).join(' / ')}, others shifted ${shifts.map((m) => m.toFixed(2)).join(' / ')} at ${FRAME_RATES.join(' / ')} fps`);
        expect(Math.min(...out)).toBeGreaterThan(5.5);
        expect(Math.max(...out) - Math.min(...out)).toBeLessThan(0.25);
        expect(Math.max(...shifts)).toBeLessThan(0.5);
    });
});
