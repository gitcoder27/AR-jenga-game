import { describe, expect, it } from 'vitest';
import { BLOCK_HALF_EXTENTS, TOWER_FOOTPRINT } from './config';
import { advanceTutorial, isPulledOut, TUTORIAL_TARGET, type TutorialSnapshot } from './tutorial';

const base: TutorialSnapshot = { trackingStatus: 'no-hand', calibrationStatus: 'idle', hoveredBlockId: null, heldBlockId: null, score: 0 };
const s = (over: Partial<TutorialSnapshot>): TutorialSnapshot => ({ ...base, ...over });

describe('tutorial steps [O-1]', () => {
    it('walks camera → calibrate → touch → grab → pull', () => {
        expect(advanceTutorial('camera', s({ trackingStatus: 'ready' }), base)).toBe('calibrate');
        expect(advanceTutorial('calibrate', s({ calibrationStatus: 'done' }), s({ calibrationStatus: 'far' }))).toBe('touch');
        expect(advanceTutorial('touch', s({ hoveredBlockId: TUTORIAL_TARGET }), base)).toBe('grab');
        expect(advanceTutorial('grab', s({ heldBlockId: null }), s({ heldBlockId: '4-0' }))).toBe('pull');
    });

    it('waits otherwise', () => {
        expect(advanceTutorial('camera', s({ trackingStatus: 'no-hand' }), base)).toBe('camera');
        // An earlier calibration doesn't count: only one finished during the step
        expect(advanceTutorial('calibrate', s({ calibrationStatus: 'done' }), s({ calibrationStatus: 'done' }))).toBe('calibrate');
        expect(advanceTutorial('touch', s({ hoveredBlockId: '9-1' }), base)).toBe('touch');
        expect(advanceTutorial('grab', s({ heldBlockId: '4-0' }), base)).toBe('grab');
        expect(advanceTutorial('pull', s({ heldBlockId: null }), s({ heldBlockId: '4-0' }))).toBe('pull');
    });

    it('a grab of any block counts as touching', () => {
        expect(advanceTutorial('touch', s({ heldBlockId: '2-1' }), base)).toBe('grab');
    });

    it('a score finishes it from any step after touching, not before', () => {
        expect(advanceTutorial('place', s({ score: 1 }), base)).toBe('done');
        expect(advanceTutorial('pull', s({ score: 1 }), base)).toBe('done');
        expect(advanceTutorial('camera', s({ score: 1 }), base)).toBe('camera');
    });

    it('a block counts as pulled out once it is mostly past the footprint', () => {
        expect(isPulledOut({ x: 0, z: 0 })).toBe(false);
        expect(isPulledOut({ x: 0, z: TOWER_FOOTPRINT + BLOCK_HALF_EXTENTS[2] })).toBe(true);
        expect(isPulledOut({ x: -(TOWER_FOOTPRINT + BLOCK_HALF_EXTENTS[2]), z: 1 })).toBe(true);
    });
});
