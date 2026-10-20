import { describe, expect, it } from 'vitest';
import { PHYSICS_TIMESTEP } from '../../src/game/config';
import { createScene, handInput } from './scene';
import { blockAxis, frontPinchPoint, grabAt } from './scenarios';

// G-8: the Tower remounts on reset (key={gameId}), which removes every block body
// (and with it the grab joint) while the hand may still be holding one.
describe('reset while holding', () => {
    it('releasing after the held block was removed does not touch freed Rapier objects', async () => {
        const scene = await createScene({ seed: 1 });
        scene.stepFor(1);
        const block = scene.block('5-0');
        const axis = blockAxis(block);
        const pinch = frontPinchPoint(block);
        expect(grabAt(scene, pinch, axis)).toBe(true);

        // Tower unmount: @react-three/rapier removes each block's body.
        for (const b of scene.blocks) scene.world.removeRigidBody(b.body);

        expect(() => {
            scene.step(() => scene.hand.update(handInput(pinch, false, axis), PHYSICS_TIMESTEP));
            scene.stepFor(0.5, () => scene.hand.update(handInput(pinch, true, axis), PHYSICS_TIMESTEP));
        }).not.toThrow();
        expect(scene.hand.heldBody).toBeNull();
        scene.free();
    });

    it('a stale grab never touches a new block that reuses the removed body\'s handle', async () => {
        const scene = await createScene({ seed: 1 });
        scene.stepFor(1);
        const block = scene.block('5-0');
        const axis = blockAxis(block);
        const pinch = frontPinchPoint(block);
        expect(grabAt(scene, pinch, axis)).toBe(true);
        const staleHandle = block.body.handle;

        // Tower remount: old bodies removed, a new tower created (Rapier reuses handles).
        for (const b of scene.blocks) scene.world.removeRigidBody(b.body);
        const fresh = Array.from({ length: 54 }, () =>
            scene.world.createRigidBody(scene.rapier.RigidBodyDesc.dynamic().setTranslation(30, 0, 0)));
        // Rapier looks handles up by slot, so the stale handle now resolves to a new body.
        expect(fresh).toContain(scene.world.getRigidBody(staleHandle));

        expect(() => scene.step(() => scene.hand.update(handInput(pinch, false, axis), PHYSICS_TIMESTEP))).not.toThrow();
        for (const b of fresh) expect(b.linearDamping()).toBe(0);
        scene.free();
    });

    it('forget() drops the grab without calling into Rapier', async () => {
        const scene = await createScene({ seed: 1 });
        scene.stepFor(1);
        const block = scene.block('5-0');
        expect(grabAt(scene, frontPinchPoint(block), blockAxis(block))).toBe(true);
        scene.hand.forget();
        expect(scene.hand.heldBody).toBeNull();
        scene.free();
    });
});
