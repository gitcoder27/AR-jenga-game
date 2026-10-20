import { beforeAll, describe, expect, it } from 'vitest';
import { knownBug } from './knownBug';
import { BLOCK_HALF_EXTENTS, GRAB_RADIUS, HAND_PARKING_POSITION, INDEX_TIP, PHYSICS_TIMESTEP, TABLE_HALF_EXTENTS, THUMB_TIP } from '../../src/game/config';
import { createRng } from '../../src/game/towerLayout';
import { findGrabCandidate, queryCursorFeedback, type Vec3 } from '../../src/game/grab';
import { createScene, handInput, maxShift, type Scene, type SceneBlock } from './scene';
import { nearestBlock } from './geometry';
import { add, blockAxis, frontPinchPoint, rebaseline } from './scenarios';

const SAMPLES = 1000;
/** Points this close to the grab radius boundary are ambiguous and skipped. */
const BOUNDARY_EPS = 0.01;

let scene: Scene;
let samples: Vec3[];

/**
 * Random points 0.1–0.9 units outside a random face of a random block, so the
 * fingertips placed there never overlap a block. Points inside the table are skipped.
 */
function samplePoints(blocks: SceneBlock[], n: number, seed: number): Vec3[] {
    const rnd = createRng(seed);
    const points: Vec3[] = [];
    const [hw, hh, hl] = BLOCK_HALF_EXTENTS;
    while (points.length < n) {
        const b = blocks[Math.floor(rnd() * blocks.length)];
        const axis = blockAxis(b);
        const side = { x: axis.z, y: 0, z: -axis.x };
        const up = { x: 0, y: 1, z: 0 };
        const frame: [Vec3, number][] = [[side, hw], [up, hh], [axis, hl]];
        const face = Math.floor(rnd() * 6);
        const [normal, half] = frame[face % 3];
        const sign = face < 3 ? 1 : -1;
        let p = add(b.body.translation(), normal, sign * (half + 0.1 + rnd() * 0.8));
        for (const [dir, h] of frame) {
            if (dir !== normal) p = add(p, dir, (rnd() * 2 - 1) * h);
        }
        const insideTable = Math.abs(p.x) < TABLE_HALF_EXTENTS[0] && Math.abs(p.z) < TABLE_HALF_EXTENTS[2] && p.y < 0;
        if (!insideTable && nearestBlock(p, blocks).distance > 0.06) points.push(p);
    }
    return points;
}

/** Tight pinch at `p`: thumb and index tips 0.05 apart (inside the query ball), other joints parked. */
function placeFingertips(p: Vec3): void {
    const [px, py, pz] = HAND_PARKING_POSITION;
    scene.handBodies.forEach((body, i) => {
        if (i === THUMB_TIP) body.setTranslation({ ...p, y: p.y - 0.025 }, true);
        else if (i === INDEX_TIP) body.setTranslation({ ...p, y: p.y + 0.025 }, true);
        else body.setTranslation({ x: px, y: py, z: pz }, true);
    });
    scene.step();
}

beforeAll(async () => {
    scene = await createScene({ seed: 7 });
    scene.stepFor(2);
    rebaseline(scene);
    samples = samplePoints(scene.blocks, SAMPLES, 99);
});

describe('grab candidate query [G-5]', () => {
    it('returns the nearest block whenever one is within the grab radius, even with fingertips inside the query', () => {
        const misses: string[] = [];
        let inRange = 0;
        for (const p of samples) {
            placeFingertips(p);
            const { block, distance } = nearestBlock(p, scene.blocks);
            if (Math.abs(distance - GRAB_RADIUS) < BOUNDARY_EPS) continue;
            const candidate = findGrabCandidate(scene.world, scene.rapier, p);
            const got = candidate?.blockId ?? null;
            if (candidate) expect(candidate.body).toBe(scene.block(candidate.blockId).body);
            const want = distance < GRAB_RADIUS ? block.id : null;
            if (want) inRange++;
            if (got !== want) misses.push(`${JSON.stringify(p)} want ${want} got ${got}`);
        }
        expect(inRange).toBeGreaterThan(300);
        // The probe itself must not have disturbed the tower.
        expect(maxShift(scene.blocks)).toBeLessThan(0.05);
        expect(misses).toEqual([]);
    });
});

describe('cursor feedback matches what a pinch would grab [F-1, F-2]', () => {
    it('"in range" ⇔ a grab candidate exists, and the hovered id is that block', () => {
        const mismatches: string[] = [];
        let inRange = 0;
        for (const p of samples) {
            const want = findGrabCandidate(scene.world, scene.rapier, p)?.blockId ?? null;
            const got = queryCursorFeedback(scene.world, scene.rapier, p).candidate?.blockId ?? null;
            if (want) inRange++;
            if (got !== want) mismatches.push(`${JSON.stringify(p)} grab=${want} cursor=${got}`);
        }
        expect(inRange).toBeGreaterThan(300);
        expect(mismatches).toEqual([]);
    });
});

describe('sticky pinch [G-4]', () => {
    knownBug('pinching in empty air and then sweeping into a block does not grab it', async () => {
        const s = await createScene({ seed: 2 });
        s.stepFor(1);
        const block = s.block('5-0');
        const axis = blockAxis(block);
        const pinch = frontPinchPoint(block);
        const away = add(pinch, axis, 4);
        // Close the hand 4 units away from the block, then sweep in while still pinching.
        for (let i = 0; i < 15; i++) s.step(() => s.hand.update(handInput(away, true, axis), PHYSICS_TIMESTEP));
        expect(s.hand.heldBody).toBeNull();
        for (let i = 1; i <= 30; i++) {
            s.step(() => s.hand.update(handInput(add(away, axis, (-4 * i) / 30), true, axis), PHYSICS_TIMESTEP));
        }
        s.stepFor(0.5, () => s.hand.update(handInput(pinch, true, axis), PHYSICS_TIMESTEP));
        expect(s.hand.heldBody).toBeNull();
        s.free();
    });
});
