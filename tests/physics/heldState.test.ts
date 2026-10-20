import { describe, expect, it } from 'vitest';
import { PHYSICS_TIMESTEP, TRACKING_LOSS_GRACE_S } from '../../src/game/config';
import { createScene, handInput } from './scene';
import { blockAxis, frontPinchPoint, grabAt } from './scenarios';

// C-2: the hand reports which block it holds, so the store's heldBlockId can follow it.
describe('held block reporting', () => {
    async function holding() {
        const scene = await createScene({ seed: 1 });
        scene.stepFor(1);
        const events: (string | null)[] = [];
        scene.hand.onHeldChange = (id) => events.push(id);
        const block = scene.block('5-0');
        const axis = blockAxis(block);
        const pinch = frontPinchPoint(block);
        expect(grabAt(scene, pinch, axis)).toBe(true);
        return { scene, events, axis, pinch };
    }

    it('reports the block id on grab and null on release', async () => {
        const { scene, events, axis, pinch } = await holding();
        expect(events).toEqual(['5-0']);
        scene.step(() => scene.hand.update(handInput(pinch, false, axis), PHYSICS_TIMESTEP));
        expect(events).toEqual(['5-0', null]);
        scene.free();
    });

    it('reports null when tracking is lost past the grace period', async () => {
        const { scene, events } = await holding();
        scene.stepFor(TRACKING_LOSS_GRACE_S + 0.1, () => scene.hand.update(null, PHYSICS_TIMESTEP));
        expect(events).toEqual(['5-0', null]);
        scene.free();
    });

    it('reports null when the held block is removed (reset)', async () => {
        const { scene, events, axis, pinch } = await holding();
        for (const b of scene.blocks) scene.world.removeRigidBody(b.body);
        scene.step(() => scene.hand.update(handInput(pinch, true, axis), PHYSICS_TIMESTEP));
        expect(events).toEqual(['5-0', null]);
        scene.free();
    });
});

// F-1: hover is reported from the same per-frame candidate the grab uses.
describe('hover reporting', () => {
    it('reports the block a pinch would grab while approaching, and clears it while holding', async () => {
        const scene = await createScene({ seed: 1 });
        scene.stepFor(1);
        const hovers: (string | null)[] = [];
        scene.hand.onHoverChange = (id) => hovers.push(id);
        const block = scene.block('5-0');
        const axis = blockAxis(block);
        const pinch = frontPinchPoint(block);
        const far = { ...pinch, x: pinch.x + axis.x * 4, z: pinch.z + axis.z * 4 };

        scene.stepFor(0.2, () => scene.hand.update(handInput(far, false, axis), PHYSICS_TIMESTEP));
        expect(scene.hand.feedback.candidate).toBeNull();
        scene.stepFor(0.3, () => scene.hand.update(handInput(pinch, false, axis), PHYSICS_TIMESTEP));
        expect(scene.hand.feedback.candidate?.blockId).toBe('5-0');
        expect(hovers).toEqual(['5-0']);

        scene.step(() => scene.hand.update(handInput(pinch, true, axis), PHYSICS_TIMESTEP));
        expect(scene.hand.heldBody).toBe(block.body);
        expect(hovers).toEqual(['5-0', null]);
        scene.free();
    });
});
