import { BLOCK_HALF_EXTENTS, TOWER_FOOTPRINT } from './config';
import { createRng, generateTowerLayout, looseBlockId } from './towerLayout';

/**
 * The guided first run (O-1), in Classic mode: see the hand, calibrate depth,
 * touch a block, grab and let go, pull a block out, put it on top.
 */
export type TutorialStep = 'camera' | 'calibrate' | 'touch' | 'grab' | 'pull' | 'place' | 'done';

export const TUTORIAL_STEPS: readonly TutorialStep[] = ['camera', 'calibrate', 'touch', 'grab', 'pull', 'place', 'done'];

/** The glowing block is this level's loose one (C-6): low enough to reach, end faces toward the default camera */
export const TUTORIAL_LEVEL = 4;

let cached: { seed: number; id: string } | null = null;
/** Id of the glowing block in the tower built from `towerSeed` */
export function tutorialTarget(towerSeed: number): string {
    if (cached?.seed !== towerSeed) cached = { seed: towerSeed, id: looseBlockId(generateTowerLayout(createRng(towerSeed)), TUTORIAL_LEVEL) };
    return cached.id;
}

export const TUTORIAL_TEXT: Record<TutorialStep, { title: string; body: string }> = {
    camera: { title: 'SHOW YOUR HAND', body: 'Hold one hand up in front of the webcam, palm facing it. The preview shows what the camera sees.' },
    calibrate: { title: 'CALIBRATE YOUR REACH', body: 'Five seconds: your hand near the webcam, then far. Your comfortable range then spans the scene.' },
    touch: { title: 'TOUCH THE GLOWING BLOCK', body: "It's a loose one: they're the ones to take. Move your hand to its near end. The block turns cyan when a pinch would grab it. Watch the depth gauge on the right." },
    grab: { title: 'PINCH, THEN LET GO', body: 'Pinch thumb and index finger to grab it (it turns green), then open your fingers to let go.' },
    pull: { title: 'PULL IT OUT', body: 'Pinch it again and draw it slowly straight out toward you. A yank slips out of your fingers.' },
    place: { title: 'PUT IT ON TOP', body: 'Lift it above the tower and let go over the top. A ghost shows where it will land; it scores once the tower settles.' },
    done: { title: "YOU'VE GOT IT", body: 'Keep going: one block per turn, and the tower must not fall. Press ? for the hints.' },
};

/** The store fields the tutorial watches */
export interface TutorialSnapshot {
    trackingStatus: string;
    calibrationStatus: string;
    hoveredBlockId: string | null;
    heldBlockId: string | null;
    score: number;
    /** The glowing block's id */
    targetId: string;
}

/**
 * The step after `step`, given the store before and after a change. The pull
 * step also ends from the physics side, when isPulledOut() holds for the moving
 * block. A score ends the tutorial from any later step.
 */
export function advanceTutorial(step: TutorialStep, now: TutorialSnapshot, before: TutorialSnapshot): TutorialStep {
    if (now.score > before.score && TUTORIAL_STEPS.indexOf(step) >= TUTORIAL_STEPS.indexOf('touch')) return 'done';
    switch (step) {
        case 'camera':
            return now.trackingStatus === 'ready' ? 'calibrate' : step;
        case 'calibrate':
            return now.calibrationStatus === 'done' && before.calibrationStatus !== 'done' ? 'touch' : step;
        case 'touch':
            return now.hoveredBlockId === now.targetId || now.heldBlockId !== null ? 'grab' : step;
        case 'grab':
            return before.heldBlockId !== null && now.heldBlockId === null ? 'pull' : step;
        default:
            return step;
    }
}

/** Whether a block centred at `p` is mostly out of the tower's footprint */
export function isPulledOut(p: { x: number; z: number }): boolean {
    return Math.max(Math.abs(p.x), Math.abs(p.z)) > TOWER_FOOTPRINT + 0.8 * BLOCK_HALF_EXTENTS[2];
}
