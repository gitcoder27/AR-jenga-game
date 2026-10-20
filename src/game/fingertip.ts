import type { Collider, RigidBody, World } from '@dimforge/rapier3d-compat';
import {
    FINGERTIP_CLEARANCE,
    FINGERTIP_HALF_LENGTH,
    FINGERTIP_MASS,
    FINGERTIP_MAX_FORCE,
    FINGERTIP_MAX_SPEED,
    FINGERTIP_RADIUS,
    FINGERTIP_RESPONSE_S,
    FINGERTIP_SNAP_DISTANCE,
    HAND_PARKING_POSITION,
    PHYSICS_TIMESTEP,
} from './config';
import type { Rapier, Vec3 } from './grab';

/** Solver groups (16-bit membership, 16-bit filter): contact forces with everything, or with nothing */
const SOLVE_EVERYTHING = 0xffff_ffff;
const SOLVE_NOTHING = 0;

/** Rotation taking +Y (a capsule's axis) onto the unit vector `d`. */
function rotationFromY(d: Vec3) {
    const w = 1 + d.y;
    if (w < 1e-6) return { x: 1, y: 0, z: 0, w: 0 };
    const n = Math.hypot(d.z, d.x, w);
    return { x: d.z / n, y: 0, z: -d.x / n, w: w / n };
}

/**
 * The only part of the hand that touches the tower (G-3): a capsule on the
 * index fingertip, driven by a velocity target with a speed and force cap, so a
 * fast swipe or a tracking glitch pushes like a finger, not a hammer. The other
 * 20 joints have no colliders, and the held block is the hand's contact while
 * carrying.
 *
 * It only pushes while the hand isn't pinching (a pinch grabs, see HandPhysics).
 * If it falls more than FINGERTIP_SNAP_DISTANCE behind the hand (blocked, or the
 * hand jumped), it teleports and stops pushing. It starts pushing again only once it is FINGERTIP_CLEARANCE clear of every block, so it never
 * spawns inside the tower, nor shoves the block it just let go of (the grip
 * point is on that block's face).
 */
export class Fingertip {
    readonly body: RigidBody;
    private readonly collider: Collider;
    private readonly world: World;
    private readonly rapier: Rapier;
    private readonly target: Vec3 = { x: 0, y: 0, z: 0 };
    private parked = true;
    private pushing = false;
    /** The capsule grown by FINGERTIP_CLEARANCE, for the "clear of every block" test */
    private readonly clearanceShape: InstanceType<Rapier['Capsule']>;

    constructor(world: World, rapier: Rapier) {
        this.world = world;
        this.rapier = rapier;
        const [x, y, z] = HAND_PARKING_POSITION;
        this.body = world.createRigidBody(
            rapier.RigidBodyDesc.dynamic()
                .setTranslation(x, y, z)
                .setGravityScale(0)
                .setCanSleep(false)
                .setCcdEnabled(true)
                .lockRotations()
                // On the body, not the collider: a disabled collider adds no mass, and a massless dynamic body stalls the solver
                .setAdditionalMass(FINGERTIP_MASS)
                .setEnabled(false),
        );
        this.clearanceShape = new rapier.Capsule(FINGERTIP_HALF_LENGTH, FINGERTIP_RADIUS + FINGERTIP_CLEARANCE);
        this.collider = world.createCollider(
            rapier.ColliderDesc.capsule(FINGERTIP_HALF_LENGTH, FINGERTIP_RADIUS).setDensity(0).setFriction(0.2).setSolverGroups(SOLVE_NOTHING),
            this.body,
        );
    }

    /** Whether the capsule can currently push blocks. */
    get isTouching(): boolean {
        return !this.parked && this.pushing;
    }

    /**
     * Call each tracked frame with the index tip, the direction the finger points
     * (distal joint → tip) and whether it should push.
     */
    track(tip: Vec3, direction: Vec3, push: boolean): void {
        const len = Math.hypot(direction.x, direction.y, direction.z) || 1;
        const d = { x: direction.x / len, y: direction.y / len, z: direction.z / len };
        // The capsule's far end sits on the fingertip
        this.target.x = tip.x - d.x * FINGERTIP_HALF_LENGTH;
        this.target.y = tip.y - d.y * FINGERTIP_HALF_LENGTH;
        this.target.z = tip.z - d.z * FINGERTIP_HALF_LENGTH;
        if (this.parked) {
            this.body.setEnabled(true);
            this.teleport();
            this.parked = false;
        }
        this.body.setRotation(rotationFromY(d), true);
        if (!push) this.setPushing(false);
        else if (!this.pushing && this.isClear()) this.setPushing(true);
    }

    /** Tracking lost: out of the world until the next track(). */
    park(): void {
        if (this.parked) return;
        this.setPushing(false);
        const [x, y, z] = HAND_PARKING_POSITION;
        this.body.setTranslation({ x, y, z }, false);
        this.body.setLinvel({ x: 0, y: 0, z: 0 }, false);
        this.body.setEnabled(false);
        this.parked = true;
    }

    /** Call before every physics step: drive toward the target with capped speed and force. */
    beforeStep(): void {
        if (this.parked) return;
        const p = this.body.translation();
        const ex = this.target.x - p.x, ey = this.target.y - p.y, ez = this.target.z - p.z;
        const error = Math.hypot(ex, ey, ez);
        this.body.resetForces(true);
        if (error > FINGERTIP_SNAP_DISTANCE) {
            this.setPushing(false);
            this.teleport();
            return;
        }
        // Velocity target: close the gap in FINGERTIP_RESPONSE_S, no faster than FINGERTIP_MAX_SPEED
        const speed = Math.min(error / FINGERTIP_RESPONSE_S, FINGERTIP_MAX_SPEED);
        const scale = error > 1e-9 ? speed / error : 0;
        const v = this.body.linvel();
        let fx = (FINGERTIP_MASS * (ex * scale - v.x)) / PHYSICS_TIMESTEP;
        let fy = (FINGERTIP_MASS * (ey * scale - v.y)) / PHYSICS_TIMESTEP;
        let fz = (FINGERTIP_MASS * (ez * scale - v.z)) / PHYSICS_TIMESTEP;
        const f = Math.hypot(fx, fy, fz);
        if (f > FINGERTIP_MAX_FORCE) {
            fx *= FINGERTIP_MAX_FORCE / f;
            fy *= FINGERTIP_MAX_FORCE / f;
            fz *= FINGERTIP_MAX_FORCE / f;
        }
        this.body.addForce({ x: fx, y: fy, z: fz }, true);
    }

    /*
     * On/off through solver groups, not collider.setEnabled: in Rapier 0.19 a
     * disabled collider's existing contact pair keeps pushing until the pair is
     * dropped, so a "disabled" fingertip went on shoving the block it was in.
     */
    private setPushing(on: boolean): void {
        if (on === this.pushing) return;
        this.pushing = on;
        this.collider.setSolverGroups(on ? SOLVE_EVERYTHING : SOLVE_NOTHING);
    }

    private teleport(): void {
        this.body.setTranslation(this.target, true);
        this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }

    private isClear(): boolean {
        return !this.world.intersectionWithShape(
            this.body.translation(),
            this.body.rotation(),
            this.clearanceShape,
            this.rapier.QueryFilterFlags.ONLY_DYNAMIC,
            undefined,
            undefined,
            this.body,
        );
    }
}
