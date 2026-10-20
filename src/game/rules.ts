import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import { KILL_PLANE_Y } from './config';

/**
 * Take dynamic bodies that fell below the kill plane out of the simulation
 * (P-5): a tunnelled block would otherwise fall and simulate forever.
 * Returns the bodies culled this call.
 */
export function cullOutOfBounds(world: World): RigidBody[] {
    const culled: RigidBody[] = [];
    world.forEachRigidBody((body) => {
        if (body.isDynamic() && body.isEnabled() && body.translation().y < KILL_PLANE_Y) culled.push(body);
    });
    for (const body of culled) {
        body.setLinvel({ x: 0, y: 0, z: 0 }, false);
        body.setAngvel({ x: 0, y: 0, z: 0 }, false);
        body.setEnabled(false);
    }
    return culled;
}
