import type RAPIER from '@dimforge/rapier3d-compat';
import type { ImpulseJoint, RigidBody, World } from '@dimforge/rapier3d-compat';
import {
    BLOCK_HEIGHT,
    BLOCK_LENGTH,
    BLOCK_WIDTH,
    GRAB_ANGULAR_FREQUENCY,
    GRAB_FREQUENCY,
    GRAB_MAX_ACCELERATION,
    GRAB_ONSET_WINDOW_S,
    GRAB_PROXY_MASS,
    GRAB_RADIUS,
    GRAB_SLIP_DISTANCE,
    GRAB_CARRY_SLIP_DISTANCE,
    GRAB_SLIP_TIME,
    PHYSICS_TIMESTEP,
    GRAVITY,
    HAND_PARKING_POSITION,
    INDEX_DIP,
    INDEX_TIP,
    THUMB_TIP,
    TOWER_FOOTPRINT,
    TRACKING_LOSS_GRACE_S,
} from './config';
import { Fingertip } from './fingertip';

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

type Quat = { x: number; y: number; z: number; w: number };

function quatMultiply(a: Quat, b: Quat): Quat {
    return {
        w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
        x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
        y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
        z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    };
}

function quatConjugate(q: Quat): Quat {
    return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

/** Rotation vector (axis × angle) that turns `from` into `to`, the short way round. */
function rotationError(from: Quat, to: Quat): Vec3 {
    let d = quatMultiply(to, quatConjugate(from));
    if (d.w < 0) d = { x: -d.x, y: -d.y, z: -d.z, w: -d.w };
    const sin = Math.hypot(d.x, d.y, d.z);
    if (sin < 1e-9) return { x: 0, y: 0, z: 0 };
    const angle = 2 * Math.atan2(sin, d.w);
    return { x: (d.x / sin) * angle, y: (d.y / sin) * angle, z: (d.z / sin) * angle };
}

/** `v` (world) in the frame rotated by `q`, and back. */
function toLocal(q: Quat, v: Vec3): Vec3 {
    const l = quatMultiply(quatMultiply(quatConjugate(q), { ...v, w: 0 }), q);
    return { x: l.x, y: l.y, z: l.z };
}

function toWorld(q: Quat, v: Vec3): Vec3 {
    const w = quatMultiply(quatMultiply(q, { ...v, w: 0 }), quatConjugate(q));
    return { x: w.x, y: w.y, z: w.z };
}

const GRAVITY_MAGNITUDE = Math.hypot(...GRAVITY);

/** A block's long axis (its local +Z) in world space. */
function blockAxis(q: Quat): Vec3 {
    return { x: 2 * (q.x * q.z + q.w * q.y), y: 2 * (q.y * q.z - q.w * q.x), z: 1 - 2 * (q.x * q.x + q.y * q.y) };
}

/**
 * The soft grab (G-1): a massless-feeling "finger" proxy, fixed to the block at
 * the pinch point, chased toward the pinch by a critically damped PD
 * controller. Its force is capped at GRAB_MAX_ACCELERATION × the block's
 * weight-free mass, so a block held fast by the tower doesn't drag the tower
 * along with unlimited force; if the block falls GRAB_SLIP_DISTANCE behind the
 * hand while it is being extracted (GRAB_CARRY_SLIP_DISTANCE once out), it slips
 * out of the fingers.
 */
interface SoftGrab {
    proxy: RigidBody;
    joint: ImpulseJoint;
    block: RigidBody;
    /** Proxy + block */
    mass: number;
    /** Moments of inertia about the pinch point, along the block's local axes */
    inertia: Vec3;
    targetRotation: Quat;
    /**
     * Being drawn out from under other blocks: pulled along its length only and
     * left resting on its supports, until its centre leaves the footprint.
     */
    extracting: boolean;
    /** How long the block has been further than the slip distance behind the pinch (s) */
    behindFor: number;
}

const outsideFootprint = (t: Vec3) => Math.max(Math.abs(t.x), Math.abs(t.z)) >= TOWER_FOOTPRINT;

/** Whether any block inside the footprint sits higher than the top face of `body`. */
function hasBlocksAbove(world: World, body: RigidBody): boolean {
    const t = body.translation();
    if (outsideFootprint(t)) return false;
    let found = false;
    world.forEachRigidBody((other) => {
        if (found || other === body || blockIdOf(other) === null) return;
        const o = other.translation();
        if (!outsideFootprint(o) && o.y > t.y + BLOCK_HEIGHT / 2) found = true;
    });
    return found;
}

/**
 * The hand between render frames (P-4). Physics steps at a fixed 60 Hz while
 * tracked samples arrive once per render frame, so each step eases the hand
 * from where it was toward the latest sample over that frame's duration,
 * instead of jumping on the first step and standing still on the next.
 */
class HandMotion {
    private from: Vec3[] = [];
    private to: Vec3[] = [];
    private readonly current: Vec3[] = [];
    private duration = 0;
    private elapsed = 0;

    /** Whether there is a hand to move */
    get active(): boolean {
        return this.to.length > 0;
    }

    /** A new sample, `dt` seconds after the previous one: ease toward it from where the hand is now. */
    setFrame(joints: readonly Vec3[], dt: number): void {
        if (!this.active) return this.jumpTo(joints);
        this.from = this.current.map((p) => ({ ...p }));
        this.to = joints.map((p) => ({ x: p.x, y: p.y, z: p.z }));
        this.duration = dt;
        this.elapsed = 0;
    }

    /** Start at `joints` with no easing (tracking (re)acquired). */
    jumpTo(joints: readonly Vec3[]): void {
        this.to = joints.map((p) => ({ x: p.x, y: p.y, z: p.z }));
        this.from = this.to;
        this.current.length = 0;
        for (const p of this.to) this.current.push({ ...p });
        this.duration = 0;
        this.elapsed = 0;
    }

    clear(): void {
        this.from = [];
        this.to = [];
        this.current.length = 0;
    }

    /** Advance by one physics step; returns the joints for that step. */
    step(dt: number): readonly Vec3[] {
        this.elapsed += dt;
        const k = this.duration > 0 ? Math.min(1, this.elapsed / this.duration) : 1;
        for (let i = 0; i < this.to.length; i++) {
            const a = this.from[i], b = this.to[i], c = this.current[i];
            c.x = a.x + (b.x - a.x) * k;
            c.y = a.y + (b.y - a.y) * k;
            c.z = a.z + (b.z - a.z) * k;
        }
        return this.current;
    }
}

/**
 * Drives the hand joint bodies and owns the grab and the fingertip.
 * The joint bodies are supplied by the caller (React components in the app, the
 * headless scene in tests). They are kinematic and have no colliders (G-3):
 * the hand touches the tower only through the Fingertip, and through the held
 * block while carrying.
 *
 * Hand targets are set per physics step (P-4, HandMotion): the joint bodies,
 * the soft grab's target and the fingertip's target all follow the same eased
 * hand. Hover, grab and the cursor use the latest sample.
 *
 * Tracking loss (H-5): the hand freezes where it was for TRACKING_LOSS_GRACE_S,
 * so brief dropouts keep the grab. After that the grab is released and the hand
 * is parked. Parking and re-acquiring teleport the bodies (no velocity).
 */
export class HandPhysics {
    private held: SoftGrab | null = null;
    private parked = true;
    private lostFor = 0;
    /** Seconds the current pinch has been closed while tracked */
    private pinchTime = 0;
    /** An open hand has been seen since tracking (re)started, so the next pinch is a real onset */
    private armed = false;
    private readonly world: World;
    private readonly rapier: Rapier;
    private readonly getBodies: () => (RigidBody | null)[];
    /** Pinch point of the latest sample: hover, grab and the cursor */
    private readonly pinch: Vec3 = { x: 0, y: 0, z: 0 };
    /** Pinch point of this physics step (eased between samples): the soft grab's target */
    private readonly stepPinch: Vec3 = { x: 0, y: 0, z: 0 };
    private readonly motion = new HandMotion();
    /** Whether the fingertip should push, decided per sample */
    private tipPushes = false;
    private readonly drop: Vec3 = { x: 0, y: 0, z: 0 };
    private hasDrop = false;
    private hover: CursorFeedback = NO_FEEDBACK;
    /** Created on the first tracked frame, so constructing a HandPhysics has no side effects on the world */
    private tip: Fingertip | null = null;
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
        return this.held?.block ?? null;
    }

    /** The pushing fingertip's body, once the hand has been tracked. */
    get fingertipBody(): RigidBody | null {
        return this.tip?.body ?? null;
    }

    /**
     * Drive the held block toward the pinch point. Call before every physics
     * step (useBeforePhysicsStep): the forces are recomputed from the current
     * error, so they stay correct whatever the render frame rate.
     */
    beforeStep(): void {
        if (!this.parked && this.motion.active) {
            const joints = this.motion.step(PHYSICS_TIMESTEP);
            const bodies = this.getBodies();
            joints.forEach((target, i) => bodies[i]?.setNextKinematicTranslation(target));
            const t = joints[THUMB_TIP], i = joints[INDEX_TIP], dip = joints[INDEX_DIP];
            if (t && i) {
                this.stepPinch.x = (t.x + i.x) / 2;
                this.stepPinch.y = (t.y + i.y) / 2;
                this.stepPinch.z = (t.z + i.z) / 2;
            }
            if (this.tip && i && dip) this.tip.track(i, { x: i.x - dip.x, y: i.y - dip.y, z: i.z - dip.z }, this.tipPushes);
        }
        this.tip?.beforeStep();
        const held = this.held;
        if (!held) return;
        if (!isLiveBody(this.world, held.block) || !isLiveBody(this.world, held.proxy)) {
            this.release();
            return;
        }
        const { proxy, mass, inertia } = held;
        const p = proxy.translation();
        const v = proxy.linvel();
        const ex = this.stepPinch.x - p.x, ey = this.stepPinch.y - p.y, ez = this.stepPinch.z - p.z;
        if (held.extracting && outsideFootprint(held.block.translation())) held.extracting = false;
        const behind = Math.hypot(ex, ey, ez) > (held.extracting ? GRAB_SLIP_DISTANCE : GRAB_CARRY_SLIP_DISTANCE);
        held.behindFor = behind ? held.behindFor + PHYSICS_TIMESTEP : 0;
        if (held.behindFor > GRAB_SLIP_TIME) {
            // The block is stuck or the hand kept moving too fast: it slips out of the fingers.
            // A one-off jump of the hand (a dropped camera frame) is caught up before then.
            this.release();
            return;
        }

        const w = 2 * Math.PI * GRAB_FREQUENCY;
        const k = mass * w * w, c = 2 * mass * w;
        let fx: number, fy: number, fz: number;
        if (held.extracting) {
            // Still in the tower: slide it along its length and let it rest on its
            // supports. Lifting it would carry the blocks above along (extraction assist).
            const a = blockAxis(held.block.rotation());
            const e = ex * a.x + ey * a.y + ez * a.z;
            const va = v.x * a.x + v.y * a.y + v.z * a.z;
            const f = k * e - c * va;
            fx = f * a.x;
            fy = f * a.y;
            fz = f * a.z;
        } else {
            // Out: carry it, holding its weight up
            fx = k * ex - c * v.x - mass * GRAVITY[0];
            fy = k * ey - c * v.y - mass * GRAVITY[1];
            fz = k * ez - c * v.z - mass * GRAVITY[2];
        }
        // Capped like a real grip
        const fMax = mass * GRAB_MAX_ACCELERATION * GRAVITY_MAGNITUDE;
        const f = Math.hypot(fx, fy, fz);
        if (f > fMax) {
            fx *= fMax / f;
            fy *= fMax / f;
            fz *= fMax / f;
        }
        proxy.resetForces(true);
        proxy.addForce({ x: fx, y: fy, z: fz }, true);

        // Keep the orientation it was grabbed with (the placement assist turns it on release)
        const wa = 2 * Math.PI * GRAB_ANGULAR_FREQUENCY;
        // Per axis in the block's frame: rolling about its long axis takes far less torque than turning it end over end
        const q = proxy.rotation();
        const e = toLocal(q, rotationError(q, held.targetRotation));
        const av = toLocal(q, proxy.angvel());
        const torque = (i: number, err: number, vel: number) => i * wa * wa * err - 2 * i * wa * vel;
        const local = { x: torque(inertia.x, e.x, av.x), y: torque(inertia.y, e.y, av.y), z: torque(inertia.z, e.z, av.z) };
        let { x: tx, y: ty, z: tz } = toWorld(q, local);
        const tMax = fMax * GRAB_SLIP_DISTANCE * 2;
        const t = Math.hypot(tx, ty, tz);
        if (t > tMax) {
            tx *= tMax / t;
            ty *= tMax / t;
            tz *= tMax / t;
        }
        proxy.resetTorques(true);
        proxy.addTorque({ x: tx, y: ty, z: tz }, true);
    }

    /** True until the first tracked frame after a tracking loss. */
    get isParked(): boolean {
        return this.parked;
    }

    /** Midpoint of the thumb and index tips, where a pinch grabs; null while parked. */
    get pinchPoint(): Readonly<Vec3> | null {
        return this.parked ? null : this.pinch;
    }

    /**
     * Where the pinch point projects straight down onto the first surface below it
     * (a block, the table or the floor), for a depth cue (F-3); null while parked.
     */
    get dropPoint(): Readonly<Vec3> | null {
        return !this.parked && this.hasDrop ? this.drop : null;
    }

    /** Pinching but not holding: the pinch closed on nothing and won't grab until reopened (G-4). */
    get pinchMissed(): boolean {
        return !this.parked && !this.held && this.pinchTime > 0 && (!this.armed || this.pinchTime > GRAB_ONSET_WINDOW_S);
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
        // The held block was removed underneath us (tower remount on reset): drop the proxy too.
        if (this.held && !isLiveBody(this.world, this.held.block)) this.release();

        if (!input) {
            this.onTrackingLost(bodies, dt);
            return;
        }
        this.lostFor = 0;

        if (this.parked) {
            // Re-acquired: teleport without velocity
            input.joints.forEach((target, i) => bodies[i]?.setTranslation(target, true));
            this.motion.jumpTo(input.joints);
            this.parked = false;
        } else {
            // The joint bodies follow in beforeStep(), eased over this frame (P-4)
            this.motion.setFrame(input.joints, dt);
        }

        // From this frame's hand, not the joint bodies, which only get there on the next step (H-6)
        const t = input.joints[THUMB_TIP];
        const i = input.joints[INDEX_TIP];
        let feedback = NO_FEEDBACK;
        if (t && i) {
            this.pinch.x = (t.x + i.x) / 2;
            this.pinch.y = (t.y + i.y) / 2;
            this.pinch.z = (t.z + i.z) / 2;
            if (!this.held) feedback = queryCursorFeedback(this.world, this.rapier, this.pinch);
            this.updateDropPoint();
        }

        if (input.pinching && !input.openPalm) {
            // Grab only as the pinch closes (G-4): a pinch made in the air, or one the
            // hand was already making when tracking (re)started, never grabs later.
            const onset = this.armed && this.pinchTime <= GRAB_ONSET_WINDOW_S;
            if (!this.held && onset && feedback.candidate) this.grab(feedback.candidate.body);
            this.pinchTime += dt;
        } else {
            this.release();
            this.pinchTime = 0;
            if (!input.closing) this.armed = true;
        }
        this.setHover(this.held ? NO_FEEDBACK : feedback);

        // The fingertip pushes only with a pointing or relaxed hand: not while pinching or carrying (the held block is the contact), nor with an open palm (camera)
        const tip = input.joints[INDEX_TIP], dip = input.joints[INDEX_DIP];
        if (tip && dip) {
            // Aimed every physics step in beforeStep(), along the eased hand
            this.tip ??= new Fingertip(this.world, this.rapier);
            this.tipPushes = !this.held && !input.pinching && !input.closing && !input.openPalm;
        }
    }

    private updateDropPoint(): void {
        const ray = new this.rapier.Ray(this.pinch, { x: 0, y: -1, z: 0 });
        // Skip the hand itself (kinematic joints, the fingertip) and the block it carries
        const tip = this.tip?.body;
        const hit = this.world.castRay(ray, 100, true, this.rapier.QueryFilterFlags.EXCLUDE_KINEMATIC, undefined, undefined, this.held?.block,
            tip ? (collider) => collider.parent() !== tip : undefined);
        this.hasDrop = hit !== null;
        if (hit) {
            this.drop.x = this.pinch.x;
            this.drop.y = this.pinch.y - hit.timeOfImpact;
            this.drop.z = this.pinch.z;
        }
    }

    private setHover(feedback: CursorFeedback): void {
        const previous = this.hover.candidate?.blockId ?? null;
        this.hover = feedback;
        const next = feedback.candidate?.blockId ?? null;
        if (next !== previous) this.onHoverChange?.(next);
    }

    /**
     * Let go of the held block and remove the proxy. Safe after the block was
     * removed from the world, e.g. by a reset remounting the tower (G-8).
     */
    release(): void {
        const held = this.held;
        if (!held) return;
        if (isLiveJoint(this.world, held.joint)) this.world.removeImpulseJoint(held.joint, true);
        if (isLiveBody(this.world, held.proxy)) this.world.removeRigidBody(held.proxy);
        if (isLiveBody(this.world, held.block)) held.block.wakeUp();
        this.forget();
    }

    /** Drop the grab without touching Rapier, e.g. when the world itself is going away. */
    forget(): void {
        const wasHolding = this.held !== null;
        this.held = null;
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
        for (const body of bodies) body?.setTranslation({ x, y, z }, false);
        this.tip?.park();
        this.motion.clear();
        this.parked = true;
    }

    /** Fix a proxy to the block at the pinch point and start driving it (see SoftGrab). */
    private grab(body: RigidBody): void {
        const { rapier, world } = this;
        const at = this.pinch;
        const rotation = body.rotation();
        const proxy = world.createRigidBody(
            rapier.RigidBodyDesc.dynamic()
                .setTranslation(at.x, at.y, at.z)
                .setRotation(rotation)
                .setGravityScale(0)
                .setCanSleep(false)
                .setAdditionalMassProperties(GRAB_PROXY_MASS, { x: 0, y: 0, z: 0 }, { x: 0.05, y: 0.05, z: 0.05 }, IDENTITY_ROTATION),
        );
        // Block-local position of the pinch point: the proxy stays fixed there
        const t = body.translation();
        const r = toLocal(rotation, { x: at.x - t.x, y: at.y - t.y, z: at.z - t.z });
        const joint = world.createImpulseJoint(
            rapier.JointData.fixed({ x: 0, y: 0, z: 0 }, IDENTITY_ROTATION, { x: r.x, y: r.y, z: r.z }, IDENTITY_ROTATION),
            proxy,
            body,
            true,
        );
        joint.setContactsEnabled(false);
        const mass = body.mass() + GRAB_PROXY_MASS;
        // Moments of inertia about the pinch point along the block's axes: the cuboid's own plus the parallel-axis term
        const m = body.mass(), r2 = r.x * r.x + r.y * r.y + r.z * r.z;
        const inertia = {
            x: m * ((BLOCK_HEIGHT ** 2 + BLOCK_LENGTH ** 2) / 12 + r2 - r.x * r.x),
            y: m * ((BLOCK_WIDTH ** 2 + BLOCK_LENGTH ** 2) / 12 + r2 - r.y * r.y),
            z: m * ((BLOCK_WIDTH ** 2 + BLOCK_HEIGHT ** 2) / 12 + r2 - r.z * r.z),
        };
        this.held = { proxy, joint, block: body, mass, inertia, targetRotation: { ...rotation }, extracting: hasBlocksAbove(world, body), behindFor: 0 };
        body.wakeUp();
        this.onHeldChange?.(blockIdOf(body));
    }
}
