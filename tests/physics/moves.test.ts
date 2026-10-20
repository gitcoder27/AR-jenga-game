import { describe, expect, it } from 'vitest';
import { BLOCK_HEIGHT, PHYSICS_TIMESTEP, TOWER_LEVELS } from '../../src/game/config';
import { SETTLE_SECONDS } from '../../src/game/moves';
import { createScene, handInput, type Scene } from './scene';
import { blockAxis, carry, extractAndCarryTo, pullBlock, rebaseline, releaseAndLeave } from './scenarios';
import { createRulesMonitor } from './appRules';

const TOP_FACE = TOWER_LEVELS * BLOCK_HEIGHT;

async function settledScene(seed: number): Promise<Scene> {
    const scene = await createScene({ seed });
    scene.stepFor(2);
    rebaseline(scene);
    return scene;
}

/** Extract `id`, carry it over the tower, lower it onto the top and let go. */
function extractAndPlace(scene: Scene, id: string): void {
    const at = extractAndCarryTo(scene, id, { x: 0, y: TOP_FACE + BLOCK_HEIGHT / 2 + 0.05, z: 0 }, TOP_FACE + 3);
    releaseAndLeave(scene, at);
}

// C-1: the move lifecycle. Extract, place on top, let the tower settle: +1.
describe('move lifecycle and scoring [C-1]', () => {
    it('extracting a block and placing it on top scores 1 once the tower settles', async () => {
        const scene = await settledScene(1);
        const rules = createRulesMonitor(scene);
        extractAndPlace(scene, '8-0');
        expect(rules.foul).toBeNull();
        expect(['SETTLING', 'IDLE']).toContain(rules.tracker.phase);
        scene.stepFor(SETTLE_SECONDS + 2);
        expect(rules.foul).toBeNull();
        expect(rules.score).toBe(1);
        expect(rules.tracker.phase).toBe('IDLE');
        expect(rules.tracker.levelOf('8-0')).toBe(TOWER_LEVELS);
        scene.free();
    });

    it('a block let go beside the tower does not score', async () => {
        const scene = await settledScene(2);
        const rules = createRulesMonitor(scene);
        const pull = pullBlock(scene, '8-0', 15, 9, 0.5);
        expect(pull.grabbed).toBe(true);
        const at = scene.hand.pinchPoint!;
        scene.stepFor(0.2, () => scene.hand.update(handInput(at, false), PHYSICS_TIMESTEP));
        scene.hand.update(null, PHYSICS_TIMESTEP);
        scene.stepFor(SETTLE_SECONDS + 2);
        expect(rules.score).toBe(0);
        expect(rules.tracker.phase).toBe('MOVED');
        scene.free();
    });

    it('a collapse fouls and never scores', async () => {
        const scene = await settledScene(3);
        const rules = createRulesMonitor(scene);
        // Knock the middle of the tower out sideways
        for (const b of scene.blocks.filter((b) => b.level >= 6 && b.level <= 8)) b.body.setLinvel({ x: 12, y: 0, z: 0 }, true);
        scene.stepFor(SETTLE_SECONDS + 3);
        expect(rules.foul?.reason).toBe('block-fell');
        expect(rules.score).toBe(0);
        scene.free();
    });

    it('dropping the moved block off the table is a foul', async () => {
        const scene = await settledScene(4);
        const rules = createRulesMonitor(scene);
        const pull = pullBlock(scene, '8-0', 15, 9, 0.5);
        expect(pull.grabbed).toBe(true);
        const axis = blockAxis(scene.block('8-0'));
        const from = scene.hand.pinchPoint!;
        const beyond = { ...from, z: from.z + 6 };
        carry(scene, from, beyond, 8, axis);
        scene.stepFor(0.2, () => scene.hand.update(handInput(beyond, false, axis), PHYSICS_TIMESTEP));
        scene.hand.update(null, PHYSICS_TIMESTEP);
        scene.stepFor(3);
        expect(rules.foul?.reason).toBe('dropped');
        scene.free();
    });
});
