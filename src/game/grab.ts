import type RAPIER from '@dimforge/rapier3d-compat';
import type { ImpulseJoint, RigidBody, World } from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Collider } from '@dimforge/rapier3d-compat';
import {
    GRAB_RADIUS,
    HAND_PARKING_POSITION,
    HELD_BLOCK_DAMPING,
    INDEX_TIP,
    THUMB_TIP,
    TRACKING_LOSS_GRACE_S,
} from './config';

export type Rapier = typeof RAPIER;

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

const IDENTITY_ROTATION = { x: 0, y: 0, z: 0, w: 1 };

/**
 * Returns the body a pinch at `point` would grab, or null.
 */
export function findGrabCandidate(world: World, rapier: Rapier, point: Vec3): RigidBody | null {
    const hit = world.intersectionWithShape(point, IDENTITY_ROTATION, new rapier.Ball(GRAB_RADIUS));
    if (!hit) return null;
    const body = hit.parent();
    return body && body.isDynamic() ? body : null;
}

export interface CursorFeedback {
    blockName: string | null;
    inRange: boolean;
    proximity: number;
}

/**
 * Proximity feedback shown by the depth cursor.
 */
export function queryCursorFeedback(world: World, rapier: Rapier, point: Vec3, previousProximity: number): CursorFeedback {
    const hit = world.intersectionWithShape(point, IDENTITY_ROTATION, new rapier.Ball(GRAB_RADIUS * 2));
    if (!hit) {
        return { blockName: null, inRange: false, proximity: previousProximity * 0.9 };
    }
    const body = hit.parent();
    if (!body || !body.isDynamic()) {
        return { blockName: null, inRange: false, proximity: 0 };
    }
    const userData = body.userData as { name?: string } | undefined;
    const name = userData?.name || '';
    const bodyPos = body.translation();
    const dist = Math.hypot(point.x - bodyPos.x, point.y - bodyPos.y, point.z - bodyPos.z);
    return {
        blockName: name.startsWith('block-') ? name : null,
        inRange: dist < GRAB_RADIUS,
        proximity: Math.max(0, 1 - dist / (GRAB_RADIUS * 2)),
    };
}

export interface HandInput {
    /** World-space target for each of the 21 hand joints this frame */
    joints: Vec3[];
    pinching: boolean;
    openPalm: boolean;
}

function forEachCollider(body: RigidBody, fn: (collider: Collider) => void): void {
    for (let i = 0; i < body.numColliders(); i++) fn(body.collider(i));
}

/**
 * Drives the kinematic hand joint bodies and owns the grab joint.
 * The bodies are supplied by the caller (React components in the app, the
 * headless scene in tests).
 *
 * Tracking loss (H-5): the hand freezes where it was for TRACKING_LOSS_GRACE_S,
 * so brief dropouts keep the grab. After that the grab is released and the hand
 * is parked with its colliders disabled. Parking and re-acquiring teleport the
 * bodies (no velocity), and a joint's collider is only re-enabled once it is
 * clear of every block, so the hand never sweeps through or spawns inside the tower.
 */
export class HandPhysics {
    private joint: ImpulseJoint | null = null;
    private grabbed: RigidBody | null = null;
    private previousDamping = { linear: 0, angular: 0 };
    private parked = true;
    private lostFor = 0;
    private readonly world: World;
    private readonly rapier: Rapier;
    private readonly getBodies: () => (RigidBody | null)[];

    constructor(world: World, rapier: Rapier, getBodies: () => (RigidBody | null)[]) {
        this.world = world;
        this.rapier = rapier;
        this.getBodies = getBodies;
    }

    get heldBody(): RigidBody | null {
        return this.grabbed;
    }

    /** True until the first tracked frame after a tracking loss. */
    get isParked(): boolean {
        return this.parked;
    }

    /**
     * Advance one frame. `input` is null when no hand was detected; `dt` is the
     * frame time in seconds.
     */
    update(input: HandInput | null, dt: number): void {
        const bodies = this.getBodies();

        if (!input) {
            this.onTrackingLost(bodies, dt);
            return;
        }
        this.lostFor = 0;

        if (this.parked) {
            // Re-acquired: teleport without velocity; colliders come back once clear.
            input.joints.forEach((target, i) => bodies[i]?.setTranslation(target, true));
            this.parked = false;
        } else {
            input.joints.forEach((target, i) => bodies[i]?.setNextKinematicTranslation(target));
        }
        this.enableClearColliders(bodies);

        if (input.pinching && !input.openPalm) {
            if (!this.joint) this.tryGrab(bodies);
        } else {
            this.release();
        }
    }

    release(): void {
        if (!this.joint) return;
        this.world.removeImpulseJoint(this.joint, true);
        this.joint = null;
        if (this.grabbed) {
            this.grabbed.setLinearDamping(this.previousDamping.linear);
            this.grabbed.setAngularDamping(this.previousDamping.angular);
            this.grabbed.wakeUp();
            this.grabbed = null;
        }
    }

    private onTrackingLost(bodies: (RigidBody | null)[], dt: number): void {
        if (this.parked) return;
        this.lostFor += dt;
        // Grace period: leave the bodies where they are (no new kinematic target = no motion).
        if (this.lostFor <= TRACKING_LOSS_GRACE_S) return;

        this.release();
        const [x, y, z] = HAND_PARKING_POSITION;
        for (const body of bodies) {
            if (!body) continue;
            forEachCollider(body, (c) => c.setEnabled(false));
            body.setTranslation({ x, y, z }, false);
        }
        this.parked = true;
    }

    private enableClearColliders(bodies: (RigidBody | null)[]): void {
        for (const body of bodies) {
            if (!body) continue;
            forEachCollider(body, (collider) => {
                if (collider.isEnabled()) return;
                const overlapping = this.world.intersectionWithShape(
                    body.translation(),
                    IDENTITY_ROTATION,
                    collider.shape,
                    this.rapier.QueryFilterFlags.ONLY_DYNAMIC,
                );
                if (!overlapping) collider.setEnabled(true);
            });
        }
    }
    private tryGrab(bodies: (RigidBody | null)[]): void {
        const thumbTip = bodies[THUMB_TIP];
        const indexTip = bodies[INDEX_TIP];
        if (!thumbTip || !indexTip) return;

        const thumbPos = thumbTip.translation();
        const indexPos = indexTip.translation();
        const mid = {
            x: (thumbPos.x + indexPos.x) / 2,
            y: (thumbPos.y + indexPos.y) / 2,
            z: (thumbPos.z + indexPos.z) / 2,
        };
        const body = findGrabCandidate(this.world, this.rapier, mid);
        if (!body) return;

        this.previousDamping = { linear: body.linearDamping(), angular: body.angularDamping() };
        body.setLinearDamping(HELD_BLOCK_DAMPING);
        body.setAngularDamping(HELD_BLOCK_DAMPING);

        const thumbRot = thumbTip.rotation();
        const bodyTrans = body.translation();
        const bodyRot = body.rotation();
        const tPos = new THREE.Vector3(thumbPos.x, thumbPos.y, thumbPos.z);
        const tQuat = new THREE.Quaternion(thumbRot.x, thumbRot.y, thumbRot.z, thumbRot.w);
        const bPos = new THREE.Vector3(bodyTrans.x, bodyTrans.y, bodyTrans.z);
        const bQuat = new THREE.Quaternion(bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w);
        const invTQuat = tQuat.clone().invert();
        const relativePos = bPos.clone().sub(tPos).applyQuaternion(invTQuat);
        const relativeRot = invTQuat.clone().multiply(bQuat);

        const params = this.rapier.JointData.fixed(
            { x: relativePos.x, y: relativePos.y, z: relativePos.z },
            { x: relativeRot.x, y: relativeRot.y, z: relativeRot.z, w: relativeRot.w },
            { x: 0, y: 0, z: 0 },
            IDENTITY_ROTATION,
        );
        this.joint = this.world.createImpulseJoint(params, thumbTip, body, true);
        this.grabbed = body;
        body.wakeUp();
    }
}
