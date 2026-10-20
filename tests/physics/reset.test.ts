import { describe, expect } from 'vitest';
import { knownBug } from './knownBug';
import { PHYSICS_TIMESTEP } from '../../src/game/config';
import { createScene, handInput } from './scene';
import { blockAxis, frontPinchPoint, grabAt } from './scenarios';

// G-8: the Tower remounts on reset (key={gameId}), which removes every block body
// (and with it the grab joint) while the hand may still be holding one.
describe('reset while holding', () => {
    knownBug('releasing after the held block was removed does not touch freed Rapier objects', async () => {
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
});
