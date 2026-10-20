import type RAPIER from '@dimforge/rapier3d-compat';
import type { ImpulseJoint, RigidBody, World } from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Collider } from '@dimforge/rapier3d-compat';
import {
    GRAB_ONSET_WINDOW_S,
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

/** `userData` every block body carries, so physics queries can map a body back to its block. */
export interface BlockUserData {
    blockId: string;
}

/** The block id of a block body, or null for anything else (hand, table, floor). */
export function blockIdOf(body: RigidBody | null | undefined): string | null {
    const data = body?.userData as Partial<BlockUserData> | undefined;
    return typeof data?.blockId === 'string' ? data.blockId : null;
}

export interface GrabCandidate {
    body: RigidBody;
    blockId: string;
    /** Distance from the query point to the block's surface (0 inside) */
    distance: number;
}

/** The block whose surface is nearest `point`, if it is closer than `radius`. */
function nearestBlockWithin(world: World, rapier: Rapier, point: Vec3, radius: number): GrabCandidate | null {
    let best: GrabCandidate | null = null;
    // All dynamic colliders touching the ball: the hand (kinematic), table and floor
    // (fixed) can't hide a block from the query (G-5).
    world.intersectionsWithShape(point, IDENTITY_ROTATION, new rapier.Ball(radius), (collider) => {
        const body = collider.parent();
        const blockId = blockIdOf(body);
        if (!body || !blockId) return true;
        const projection = collider.projectPoint(point, true);
        const distance = !projection || projection.isInside ? 0 : Math.hypot(
            projection.point.x - point.x, projection.point.y - point.y, projection.point.z - point.z);
        if (distance < radius && (!best || distance < best.distance)) best = { body, blockId, distance };
        return true;
    }, rapier.QueryFilterFlags.ONLY_DYNAMIC);
    return best;
}

/**
 * The block a pinch at `point` would grab: the block nearest the point by
 * surface distance, within GRAB_RADIUS. Grab and hover feedback both use this (F-2, G-5).
 */
export function findGrabCandidate(world: World, rapier: Rapier, point: Vec3): GrabCandidate | null {
    return nearestBlockWithin(world, rapier, point, GRAB_RADIUS);
}

export interface CursorFeedback {
    /** What a pinch here would grab; null when out of range */
    candidate: GrabCandidate | null;
    /** 0 (nothing within 2 × GRAB_RADIUS) to 1 (touching a block) */
    proximity: number;
}

export const NO_FEEDBACK: CursorFeedback = { candidate: null, proximity: 0 };

/**
 * Hover feedback at `point`. `candidate` is exactly findGrabCandidate(point),
 * so "in range" is shown if and only if a pinch would grab (F-1, F-2).
 */
export function queryCursorFeedback(world: World, rapier: Rapier, point: Vec3): CursorFeedback {
    const near = nearestBlockWithin(world, rapier, point, GRAB_RADIUS * 2);
    if (!near) return NO_FEEDBACK;
    return {
        candidate: near.distance < GRAB_RADIUS ? near : null,
        proximity: 1 - near.distance / (GRAB_RADIUS * 2),
    };
}

export interface HandInput {
    /** World-space target for each of the 21 hand joints this frame */
    joints: Vec3[];
    pinching: boolean;
    openPalm: boolean;
    /**
     * A pinch is forming but not yet confirmed (gesture debounce). Counts as
     * neither open nor pinching, so a hand that reappears already pinched
     * doesn't look like it opened and closed again (G-4).
     */
    closing?: boolean;
}

/*
 * Rapier's JS lookup tables are keyed by arena slot only, so a stale handle
 * resolves to whatever object reuses that slot. Compare identity, not just existence.
 */
function isLiveBody(world: World, body: RigidBody): boolean {
    return world.getRigidBody(body.handle) === body;
}

function isLiveJoint(world: World, joint: ImpulseJoint): boolean {
    return world.getImpulseJoint(joint.handle) === joint;
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
    /** Seconds the current pinch has been closed while tracked */
    private pinchTime = 0;
    /** An open hand has been seen since tracking (re)started, so the next pinch is a real onset */
    private armed = false;
    private readonly world: World;
    private readonly rapier: Rapier;
    private readonly getBodies: () => (RigidBody | null)[];
    private readonly pinch: Vec3 = { x: 0, y: 0, z: 0 };
    private hover: CursorFeedback = NO_FEEDBACK;
    /** Called with the block id on grab and null when the grab ends for any reason (C-2). */
    onHeldChange: ((blockId: string | null) => void) | null;
    /** Called when the block a pinch would grab changes (F-1). */
    onHoverChange: ((blockId: string | null) => void) | null;

    constructor(
        world: World,
        rapier: Rapier,
        getBodies: () => (RigidBody | null)[],
        listeners: Partial<Pick<HandPhysics, 'onHeldChange' | 'onHoverChange'>> = {},
    ) {
        this.world = world;
        this.rapier = rapier;
        this.getBodies = getBodies;
        this.onHeldChange = listeners.onHeldChange ?? null;
        this.onHoverChange = listeners.onHoverChange ?? null;
    }

    get heldBody(): RigidBody | null {
        return this.grabbed;
    }

    /** True until the first tracked frame after a tracking loss. */
    get isParked(): boolean {
        return this.parked;
    }

    /** Midpoint of the thumb and index tips, where a pinch grabs; null while parked. */
    get pinchPoint(): Readonly<Vec3> | null {
        return this.parked ? null : this.pinch;
    }

    /** Pinching but not holding: the pinch closed on nothing and won't grab until reopened (G-4). */
    get pinchMissed(): boolean {
        return !this.parked && !this.joint && this.pinchTime > 0 && (!this.armed || this.pinchTime > GRAB_ONSET_WINDOW_S);
    }

    /** Hover feedback at the pinch point this frame. Empty while holding or parked. */
    get feedback(): CursorFeedback {
        return this.hover;
    }

    /**
     * Advance one frame. `input` is null when no hand was detected; `dt` is the
     * frame time in seconds.
     */
    update(input: HandInput | null, dt: number): void {
        const bodies = this.getBodies();
        // The held block was removed underneath us (tower remount on reset): the joint went with it.
        if (this.joint && !isLiveJoint(this.world, this.joint)) this.forget();

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

        const thumbTip = bodies[THUMB_TIP];
        const indexTip = bodies[INDEX_TIP];
        let feedback = NO_FEEDBACK;
        if (thumbTip && indexTip) {
            const t = thumbTip.translation();
            const i = indexTip.translation();
            this.pinch.x = (t.x + i.x) / 2;
            this.pinch.y = (t.y + i.y) / 2;
            this.pinch.z = (t.z + i.z) / 2;
            if (!this.joint) feedback = queryCursorFeedback(this.world, this.rapier, this.pinch);
        }

        if (input.pinching && !input.openPalm) {
            // Grab only as the pinch closes (G-4): a pinch made in the air, or one the
            // hand was already making when tracking (re)started, never grabs later.
            const onset = this.armed && this.pinchTime <= GRAB_ONSET_WINDOW_S;
            if (!this.joint && onset && feedback.candidate && thumbTip) this.grab(thumbTip, feedback.candidate.body);
            this.pinchTime += dt;
        } else {
            this.release();
            this.pinchTime = 0;
            if (!input.closing) this.armed = true;
        }
        this.setHover(this.joint ? NO_FEEDBACK : feedback);
    }

    private setHover(feedback: CursorFeedback): void {
        const previous = this.hover.candidate?.blockId ?? null;
        this.hover = feedback;
        const next = feedback.candidate?.blockId ?? null;
        if (next !== previous) this.onHoverChange?.(next);
    }

    /**
     * Let go of the held block. Safe after the block (and so the joint) was
     * removed from the world, e.g. by a reset remounting the tower (G-8).
     */
    release(): void {
        if (!this.joint) return;
        if (isLiveJoint(this.world, this.joint)) this.world.removeImpulseJoint(this.joint, true);
        if (this.grabbed && isLiveBody(this.world, this.grabbed)) {
            this.grabbed.setLinearDamping(this.previousDamping.linear);
            this.grabbed.setAngularDamping(this.previousDamping.angular);
            this.grabbed.wakeUp();
        }
        this.forget();
    }

    /** Drop the grab without touching Rapier. Call when the world's blocks were replaced. */
    forget(): void {
        const wasHolding = this.grabbed !== null;
        this.joint = null;
        this.grabbed = null;
        if (wasHolding) this.onHeldChange?.(null);
    }

    private onTrackingLost(bodies: (RigidBody | null)[], dt: number): void {
        if (this.parked) return;
        this.lostFor += dt;
        // Grace period: leave the bodies where they are (no new kinematic target = no motion).
        if (this.lostFor <= TRACKING_LOSS_GRACE_S) return;

        this.release();
        this.setHover(NO_FEEDBACK);
        this.armed = false;
        this.pinchTime = 0;
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
    private grab(thumbTip: RigidBody, body: RigidBody): void {
        const thumbPos = thumbTip.translation();
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
        this.onHeldChange?.(blockIdOf(body));
    }
}
