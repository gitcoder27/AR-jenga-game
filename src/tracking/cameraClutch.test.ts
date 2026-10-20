import { describe, expect, it } from 'vitest';
import { CAMERA_CLUTCH_HOLD_MS, CAMERA_ORBIT_SENSITIVITY } from '../game/config';
import { CameraClutch, OrbitDrive, type ClutchChange } from './cameraClutch';
import type { HandGesture, TrackedHand } from './handTracker';

const GESTURES: Record<'open' | 'pinch' | 'closing' | 'idle', HandGesture> = {
    open: { state: 'OPEN_PALM', isPinching: false, isOpenPalm: true, isClosing: false, confidence: 1 },
    pinch: { state: 'PINCHING', isPinching: true, isOpenPalm: false, isClosing: false, confidence: 1 },
    closing: { state: 'PINCH_READY', isPinching: false, isOpenPalm: false, isClosing: true, confidence: 0.5 },
    idle: { state: 'IDLE', isPinching: false, isOpenPalm: false, isClosing: false, confidence: 0 },
};

function hand(gesture: keyof typeof GESTURES, timestamp: number, x = 0.5, y = 0.5): TrackedHand {
    return {
        landmarks: Array.from({ length: 21 }, () => ({ x, y, z: 0 })),
        gesture: GESTURES[gesture],
        depth: 0,
        timestamp,
    };
}

/** Feed 30 fps detections from `from` to `to` ms; returns the first change and when it came */
function run(clutch: CameraClutch, gesture: keyof typeof GESTURES, from: number, to: number, opts: { on?: boolean; holding?: boolean; x?: (t: number) => number } = {}) {
    for (let t = from; t <= to; t += 1000 / 30) {
        const change: ClutchChange = clutch.update(hand(gesture, t, opts.x?.(t) ?? 0.5), opts.on ?? false, opts.holding ?? false);
        if (change) return { change, at: t };
    }
    return { change: null, at: to };
}

describe('CameraClutch [H-2]', () => {
    it('enters camera mode after an open palm is held still for the hold time, not before', () => {
        const clutch = new CameraClutch();
        const { change, at } = run(clutch, 'open', 0, 2000);
        expect(change).toBe('enter');
        expect(at).toBeGreaterThanOrEqual(CAMERA_CLUTCH_HOLD_MS);
        expect(at).toBeLessThan(CAMERA_CLUTCH_HOLD_MS + 50);
    });

    it('shows the hold filling up while arming', () => {
        const clutch = new CameraClutch();
        run(clutch, 'open', 0, CAMERA_CLUTCH_HOLD_MS / 2);
        expect(clutch.progress).toBeGreaterThan(0.4);
        expect(clutch.progress).toBeLessThan(0.6);
        clutch.update(hand('idle', CAMERA_CLUTCH_HOLD_MS), false, false);
        expect(clutch.progress).toBe(0);
    });

    it('never enters while an open palm keeps moving (the natural release-and-move-away)', () => {
        const clutch = new CameraClutch();
        // 0.25 frame widths per second, like moving away after letting go
        expect(run(clutch, 'open', 0, 3000, { x: (t) => 0.2 + t / 4000 }).change).toBeNull();
        // 0.07 per second: the slow move in e2e/camera.spec.ts, which armed with a looser band
        expect(run(clutch, 'open', 0, 3000, { x: (t) => 0.2 + (0.07 * t) / 1000 }).change).toBeNull();
    });

    it('a still hand that is not an open palm never enters', () => {
        const clutch = new CameraClutch();
        expect(run(clutch, 'idle', 0, 3000).change).toBeNull();
        expect(run(clutch, 'closing', 0, 3000).change).toBeNull();
    });

    it('never arms while holding a block', () => {
        const clutch = new CameraClutch();
        expect(run(clutch, 'open', 0, 3000, { holding: true }).change).toBeNull();
        expect(clutch.progress).toBe(0);
    });

    it('a brief open palm interrupted by a pinch restarts the hold', () => {
        const clutch = new CameraClutch();
        run(clutch, 'open', 0, 300);
        clutch.update(hand('pinch', 333), false, false);
        const { change, at } = run(clutch, 'open', 366, 2000);
        expect(change).toBe('enter');
        expect(at - 366).toBeGreaterThanOrEqual(CAMERA_CLUTCH_HOLD_MS - 1);
    });

    it('exits on a pinch, a closing hand or a lost hand; any other pose keeps it on', () => {
        const clutch = new CameraClutch();
        expect(run(clutch, 'open', 0, 1000, { on: true }).change).toBeNull();
        expect(run(clutch, 'idle', 0, 1000, { on: true }).change).toBeNull();
        expect(clutch.update(hand('pinch', 0), true, false)).toBe('exit');
        expect(clutch.update(hand('closing', 0), true, false)).toBe('exit');
        expect(clutch.update(null, true, false)).toBe('exit');
    });

    it('turned on with no hand in view (HUD or C key), it waits for a hand instead of ending', () => {
        const clutch = new CameraClutch();
        clutch.update(null, false, false);
        expect(clutch.update(null, true, false)).toBeNull();
        expect(clutch.update(hand('idle', 0), true, false)).toBeNull();
        expect(clutch.update(null, true, false)).toBe('exit');
    });
});

describe('OrbitDrive [H-2]', () => {
    const drive = (path: (t: number) => number, seconds: number) => {
        const orbit = new OrbitDrive();
        let azimuth = 0;
        for (let t = 0; t <= seconds; t += 1 / 60) azimuth += orbit.update({ x: path(t), y: 0.5 }, 1 / 60).azimuth;
        return azimuth;
    };

    it('turns about CAMERA_ORBIT_SENSITIVITY radians per frame width', () => {
        // A quarter of the frame in a second, then rest
        const azimuth = drive((t) => 0.4 + 0.25 * Math.min(1, t), 2);
        expect(azimuth).toBeGreaterThan(0.25 * CAMERA_ORBIT_SENSITIVITY * 0.8);
        expect(azimuth).toBeLessThan(0.25 * CAMERA_ORBIT_SENSITIVITY);
    });

    it('a resting hand with tracking jitter does not drift the view', () => {
        // ±0.003 frame widths of frame-to-frame jitter, more than the filtered landmarks show at rest
        let seed = 1;
        const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.006;
        const azimuth = drive(() => 0.5 + noise(), 5);
        expect(Math.abs(azimuth)).toBeLessThan(0.001);
    });
});
