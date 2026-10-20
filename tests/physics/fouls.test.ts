import { describe, expect, it } from 'vitest';
import type { RigidBody } from '@dimforge/rapier3d-compat';
import { BLOCK_GAP, BLOCK_HEIGHT, BLOCK_WIDTH } from '../../src/game/config';
import { createScene, type Scene, type SceneBlock } from './scene';
import { add, blockAxis, pullBlock, rebaseline } from './scenarios';
import { createRulesMonitor } from './appRules';

/** Half-extent of the tower's square footprint. */
const FOOTPRINT = 1.5 * BLOCK_WIDTH + BLOCK_GAP;
const FOUL_LATENCY = 0.5;

/**
 * A block is clearly dislodged once its centre leaves the tower footprint or
 * it drops a quarter block height below its rest pose. Independent of the
 * app's own rule; the app must report a foul within FOUL_LATENCY of this.
 */
function isDislodged(b: SceneBlock): boolean {
    const t = b.body.translation();
    return Math.max(Math.abs(t.x), Math.abs(t.z)) > FOOTPRINT || b.spawn.y - t.y > BLOCK_HEIGHT / 4;
}

/** A kinematic box that sweeps at constant velocity, standing in for a careless finger. */
function createPusher(scene: Scene, at: { x: number; y: number; z: number }, half: [number, number, number]): RigidBody {
    const { rapier, world } = scene;
    const body = world.createRigidBody(rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(at.x, at.y, at.z));
    world.createCollider(rapier.ColliderDesc.cuboid(...half), body);
    return body;
}

interface FoulTiming { dislodgedAt: number | null; fouledAt: number | null }

async function settledScene(seed: number): Promise<Scene> {
    const scene = await createScene({ seed });
    scene.stepFor(2);
    rebaseline(scene);
    return scene;
}

/** Steps the scene, tracking when the first block is dislodged and when the app reports a foul. */
function observe(scene: Scene, seconds: number, drive: (t: number) => void): FoulTiming {
    const monitor = createRulesMonitor(scene);
    const timing: FoulTiming = { dislodgedAt: null, fouledAt: null };
    const start = scene.time;
    const steps = Math.round(seconds * 60);
    for (let i = 0; i < steps; i++) {
        scene.step(() => drive(scene.time - start));
        const t = scene.time - start;
        if (timing.dislodgedAt === null && scene.blocks.some((b) => isDislodged(b))) timing.dislodgedAt = t;
        if (timing.fouledAt === null && monitor.check()) timing.fouledAt = t;
    }
    return timing;
}

function expectPromptFoul(timing: FoulTiming): void {
    expect(timing.dislodgedAt).not.toBeNull();
    expect(timing.fouledAt).not.toBeNull();
    expect(timing.fouledAt! - timing.dislodgedAt!).toBeLessThanOrEqual(FOUL_LATENCY);
}

// C-4: report fouls as soon as a block falls from the tower, not when it reaches the floor.
describe('collapse-to-foul latency', () => {
    it('pushing a top block off the tower fouls within 0.5 s', async () => {
        const scene = await settledScene(4);
        const block = scene.block('17-1');
        const axis = blockAxis(block);
        const start = add(block.body.translation(), axis, -(3.75 + 0.35));
        const pusher = createPusher(scene, start, [0.3, 0.4, 0.3]);
        const timing = observe(scene, 6, (t) => pusher.setNextKinematicTranslation(add(start, axis, Math.min(t, 2.5) * 3)));
        expectPromptFoul(timing);
        scene.free();
    });

    it('pushing a low block out onto the table fouls within 0.5 s', async () => {
        const scene = await settledScene(5);
        const block = scene.block('2-1');
        const axis = blockAxis(block);
        const start = add(block.body.translation(), axis, -(3.75 + 0.35));
        const pusher = createPusher(scene, start, [0.3, 0.4, 0.3]);
        const timing = observe(scene, 6, (t) => pusher.setNextKinematicTranslation(add(start, axis, Math.min(t, 2.5) * 3)));
        expectPromptFoul(timing);
        scene.free();
    });

    it('sweeping through the middle of the tower (collapse) fouls within 0.5 s', async () => {
        const scene = await settledScene(6);
        const from = { x: -8, y: 9, z: 0 };
        const pusher = createPusher(scene, from, [0.5, 1.2, 4]);
        const timing = observe(scene, 6, (t) => pusher.setNextKinematicTranslation({ ...from, x: from.x + Math.min(t, 1.6) * 10 }));
        expectPromptFoul(timing);
        scene.free();
    });

    it('a clean brisk extraction of a held block never fouls', async () => {
        const scene = await settledScene(1);
        const monitor = createRulesMonitor(scene);
        const result = pullBlock(scene, '8-0', 15);
        expect(result.grabbed).toBe(true);
        expect(monitor.tracker.movingId).toBe('8-0');
        expect(monitor.check()).toBe(false);
        scene.free();
    });

    it('a resting tower never fouls', async () => {
        const scene = await settledScene(2);
        const timing = observe(scene, 10, () => {});
        expect(timing.fouledAt).toBeNull();
        scene.free();
    });
});
