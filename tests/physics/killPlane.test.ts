import { describe, expect, it } from 'vitest';
import { KILL_PLANE_Y } from '../../src/game/config';
import { cullOutOfBounds } from '../../src/game/rules';
import { createScene } from './scene';

// P-5: a block that leaves the world must stop simulating (and is a foul in Classic).
describe('kill plane', () => {
    it('culls a block that falls below the kill plane, and nothing else', async () => {
        const scene = await createScene({ seed: 1 });
        scene.stepFor(1);
        expect(cullOutOfBounds(scene.world)).toEqual([]);

        const lost = scene.block('17-0').body;
        lost.setTranslation({ x: 30, y: KILL_PLANE_Y - 5, z: 0 }, true);
        lost.setLinvel({ x: 0, y: -50, z: 0 }, true);
        scene.step();

        const culled = cullOutOfBounds(scene.world);
        expect(culled).toEqual([lost]);
        expect(lost.isEnabled()).toBe(false);
        const y = lost.translation().y;
        scene.stepFor(1);
        expect(lost.translation().y).toBe(y);
        expect(cullOutOfBounds(scene.world)).toEqual([]);
        scene.free();
    });
});
