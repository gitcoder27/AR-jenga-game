/**
 * Adapter between the physics scenarios and the app's rules, so the fouls and
 * scoring tests assert behaviour without caring how the app implements it.
 *
 * The app runs MoveTracker after every physics step (RulesMonitor.tsx) and
 * feeds it the hand's held block; this does the same for a headless scene.
 */
import { PHYSICS_TIMESTEP } from '../../src/game/config';
import { MoveTracker, type FoulReason } from '../../src/game/moves';
import type { Scene } from './scene';

export interface RulesMonitor {
    tracker: MoveTracker;
    score: number;
    foul: { reason: FoulReason; blockId: string } | null;
    /** Returns true once a foul has been detected. */
    check(): boolean;
}

export function createRulesMonitor(scene: Scene): RulesMonitor {
    const monitor: RulesMonitor = {
        tracker: new MoveTracker({
            onScore: () => { monitor.score += 1; },
            onFoul: (reason, blockId) => { monitor.foul ??= { reason, blockId }; },
        }),
        score: 0,
        foul: null,
        check: () => monitor.foul !== null,
    };
    scene.hand.onHeldChange = (id) => monitor.tracker.setHeld(id);
    scene.afterStep = () => monitor.tracker.step(scene.world, PHYSICS_TIMESTEP);
    return monitor;
}
