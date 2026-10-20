import {
    CAMERA_CLUTCH_HOLD_MS,
    CAMERA_CLUTCH_STILL,
    CAMERA_ORBIT_DEADZONE,
    CAMERA_ORBIT_SENSITIVITY,
    CAMERA_ORBIT_SMOOTHING_S,
} from '../game/config';
import type { Landmark, TrackedHand } from './handTracker';

/** Wrist and finger bases: the palm, which barely moves when the fingers do */
const PALM_LANDMARKS = [0, 5, 9, 13, 17];

/** Where the palm is, in normalized image units */
export function palmCentre(landmarks: readonly Landmark[]): { x: number; y: number } {
    let x = 0, y = 0;
    for (const i of PALM_LANDMARKS) {
        x += landmarks[i].x;
        y += landmarks[i].y;
    }
    return { x: x / PALM_LANDMARKS.length, y: y / PALM_LANDMARKS.length };
}

export type ClutchChange = 'enter' | 'exit' | null;

/**
 * Camera mode is deliberate and clutched (H-2): the hand turns the view only
 * after an open palm has been held still for CAMERA_CLUTCH_HOLD_MS, and stops
 * at a pinch, a closing hand or when the hand is lost. The HUD toggle and the
 * C key enter it too, even with no hand in view: then it waits for a hand
 * rather than ending at once (the store's isCameraMode is the mode itself; this only
 * decides when the hand changes it).
 *
 * Fed once per detection with the tracker's timestamps, so arming time is
 * independent of the display's frame rate.
 */
export class CameraClutch {
    /** 0–1, how far an open palm is through the hold; 0 when not arming */
    progress = 0;
    private anchor: { x: number; y: number } | null = null;
    private since = 0;
    /** A hand has been seen since camera mode came on */
    private seen = false;

    /**
     * @param cameraOn whether camera mode is on now
     * @param holding whether a block is held: never arm while carrying
     * @returns the change the hand asks for, if any
     */
    update(hand: TrackedHand | null, cameraOn: boolean, holding: boolean): ClutchChange {
        if (cameraOn) {
            this.disarm();
            if (!hand) return this.seen ? 'exit' : null;
            this.seen = true;
            const { isPinching, isClosing } = hand.gesture;
            return isPinching || isClosing ? 'exit' : null;
        }
        this.seen = false;
        if (!hand || holding || !hand.gesture.isOpenPalm) {
            this.disarm();
            return null;
        }
        const palm = palmCentre(hand.landmarks);
        // Moving restarts the hold: a palm swept after a release never arms
        if (!this.anchor || Math.hypot(palm.x - this.anchor.x, palm.y - this.anchor.y) > CAMERA_CLUTCH_STILL) {
            this.anchor = palm;
            this.since = hand.timestamp;
        }
        this.progress = Math.min(1, (hand.timestamp - this.since) / CAMERA_CLUTCH_HOLD_MS);
        if (this.progress < 1) return null;
        this.disarm();
        return 'enter';
    }

    private disarm(): void {
        this.anchor = null;
        this.progress = 0;
    }
}

/**
 * Turns palm motion into orbit angles while camera mode is on (H-2): about
 * CAMERA_ORBIT_SENSITIVITY radians per frame width, with a dead band and
 * smoothing.
 *
 * The dead band is a backlash: the palm moves freely within
 * CAMERA_ORBIT_DEADZONE of a reference point, and only motion beyond it turns
 * the view. Tracking jitter on a resting hand never drifts the view, and a
 * deliberate sweep turns it by its full length less the band.
 */
export class OrbitDrive {
    private ref: { x: number; y: number } | null = null;
    private velocity = { x: 0, y: 0 };

    /** Stop following the palm (camera mode off or the hand lost); the next sample starts afresh */
    reset(): void {
        this.ref = null;
        this.velocity = { x: 0, y: 0 };
    }

    /**
     * One render frame with the palm at `palm` (normalized image units, or null).
     * @returns the azimuth and polar changes for this frame, in radians
     */
    update(palm: { x: number; y: number } | null, dt: number): { azimuth: number; polar: number } {
        if (!palm || dt <= 0) {
            this.reset();
            return { azimuth: 0, polar: 0 };
        }
        const ref = this.ref ?? { ...palm };
        this.ref = ref;
        let mx = 0, my = 0;
        const dx = palm.x - ref.x, dy = palm.y - ref.y;
        const off = Math.hypot(dx, dy);
        if (off > CAMERA_ORBIT_DEADZONE) {
            const k = (off - CAMERA_ORBIT_DEADZONE) / off;
            mx = dx * k;
            my = dy * k;
            ref.x += mx;
            ref.y += my;
        }
        const k = 1 - Math.exp(-dt / CAMERA_ORBIT_SMOOTHING_S);
        this.velocity.x += (mx / dt - this.velocity.x) * k;
        this.velocity.y += (my / dt - this.velocity.y) * k;
        // Same directions as before H-2: the hand moving right (in image x) increases the azimuth
        return {
            azimuth: this.velocity.x * dt * CAMERA_ORBIT_SENSITIVITY,
            polar: -this.velocity.y * dt * CAMERA_ORBIT_SENSITIVITY,
        };
    }
}
