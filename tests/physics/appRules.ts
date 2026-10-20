/**
 * Adapter between the physics scenarios and the app's foul detection, so the
 * fouls tests assert behaviour without caring how the app implements it.
 *
 * Current app rule (Block.tsx onCollisionEnter): a CLASSIC game ends when a
 * block that is not held touches the body named "floor".
 */
import type { Scene } from './scene';

export interface FoulMonitor {
    /** Call after every physics step. Returns true once a foul has been detected. */
    check(heldId: string | null): boolean;
}

export function createFoulMonitor(scene: Scene): FoulMonitor {
    const blockByHandle = new Map(scene.blocks.map((b) => [b.body.handle, b]));
    let fouled = false;
    return {
        check(heldId) {
            scene.eventQueue.drainCollisionEvents((h1, h2, started) => {
                if (!started) return;
                const b1 = scene.world.getCollider(h1)?.parent();
                const b2 = scene.world.getCollider(h2)?.parent();
                for (const [a, b] of [[b1, b2], [b2, b1]]) {
                    const block = a ? blockByHandle.get(a.handle) : undefined;
                    if (block && b === scene.floor && block.id !== heldId) fouled = true;
                }
            });
            return fouled;
        },
    };
}
