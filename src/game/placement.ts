import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import { BLOCK_GAP, BLOCK_HEIGHT, BLOCK_WIDTH, BLOCKS_PER_LEVEL, TOWER_FOOTPRINT } from './config';
import { blockIdOf, type Vec3 } from './grab';
import { isLevelRotated, levelCenterY } from './towerLayout';

const SPACING = BLOCK_WIDTH + BLOCK_GAP;
/** The assist engages when the held block's centre is within this horizontal distance of the slot… */
export const ASSIST_RADIUS = BLOCK_WIDTH * 1.2;
/** …and between the top face and this far above it. */
export const ASSIST_HEIGHT = BLOCK_HEIGHT * 4;
/** Duration of the snap into the slot after release. */
export const SNAP_SECONDS = 0.25;
/** Snapped blocks are put down this far above the slot to avoid starting in contact. */
const SNAP_CLEARANCE = 0.02;

export interface PlacementSlot {
    level: number;
    /** -1, 0 or 1 across the level */
    slot: number;
    position: Vec3;
    /** Rotation about Y, matching the tower layout for that level */
    yaw: number;
}

function slotPosition(level: number, slot: number): Vec3 {
    const y = levelCenterY(level);
    return isLevelRotated(level) ? { x: 0, y, z: slot * SPACING } : { x: slot * SPACING, y, z: 0 };
}

function slotYaw(level: number): number {
    return isLevelRotated(level) ? Math.PI / 2 : 0;
}

/** The level a resting block belongs to, and its slot across that level. */
function levelAndSlot(t: Vec3): { level: number; slot: number } {
    const level = Math.round((t.y - BLOCK_HEIGHT / 2) / BLOCK_HEIGHT);
    const across = isLevelRotated(level) ? t.z : t.x;
    return { level, slot: Math.max(-1, Math.min(1, Math.round(across / SPACING))) };
}

/**
 * Where a block goes on top of the tower (C-3, G-6): a free slot in the top
 * level if it isn't full, otherwise a slot in a new level. Of the free slots,
 * the one nearest `near`. Blocks outside the footprint, and `exclude`, are ignored.
 */
export function findPlacementSlot(world: World, near: Vec3, exclude: RigidBody | null): PlacementSlot | null {
    const byLevel = new Map<number, Set<number>>();
    let top = -1;
    world.forEachRigidBody((body) => {
        if (body === exclude || !body.isEnabled() || blockIdOf(body) === null) return;
        const t = body.translation();
        if (Math.max(Math.abs(t.x), Math.abs(t.z)) > TOWER_FOOTPRINT) return;
        const { level, slot } = levelAndSlot(t);
        if (!byLevel.has(level)) byLevel.set(level, new Set());
        byLevel.get(level)!.add(slot);
        top = Math.max(top, level);
    });
    if (top < 0) return null;
    const topSlots = byLevel.get(top)!;
    const level = topSlots.size >= BLOCKS_PER_LEVEL ? top + 1 : top;
    const taken = level === top ? topSlots : new Set<number>();

    let best: PlacementSlot | null = null;
    let bestDistance = Infinity;
    for (const slot of [-1, 0, 1]) {
        if (taken.has(slot)) continue;
        const position = slotPosition(level, slot);
        const d = Math.hypot(position.x - near.x, position.z - near.z);
        if (d < bestDistance) {
            bestDistance = d;
            best = { level, slot, position, yaw: slotYaw(level) };
        }
    }
    return best;
}

/** Yaw of a body about Y, folded into [0, π) since a block is symmetric end to end. */
function foldedYaw(q: { x: number; y: number; z: number; w: number }): number {
    const yaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
    return ((yaw % Math.PI) + Math.PI) % Math.PI;
}

function quatFromYaw(yaw: number) {
    return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
}

interface Snap {
    body: RigidBody;
    from: Vec3;
    fromYaw: number;
    to: PlacementSlot;
    t: number;
}

/**
 * Placement assist (C-3, G-6). While a block is held over the top of the
 * tower it shows the slot it would go into (`ghost`). Letting go while the
 * ghost shows eases the block into the slot, turned to the level's
 * orientation, then hands it back to the physics.
 */
export class PlacementAssist {
    private _ghost: PlacementSlot | null = null;
    private lastHeld: RigidBody | null = null;
    private snap: Snap | null = null;
    private readonly world: World;
    /** Called when the ghost appears, moves to another slot or disappears, with "level-slot" or null. */
    onTargetChange: ((target: string | null) => void) | null;

    constructor(world: World, onTargetChange: ((target: string | null) => void) | null = null) {
        this.world = world;
        this.onTargetChange = onTargetChange;
    }

    /** The slot the held block would snap into if let go now. */
    get ghost(): Readonly<PlacementSlot> | null {
        return this._ghost;
    }

    get isSnapping(): boolean {
        return this.snap !== null;
    }

    /** Call once per step with the currently held body (or null). */
    update(held: RigidBody | null, dt: number): void {
        if (this.snap) this.advanceSnap(dt);

        if (held === null && this.lastHeld !== null && this._ghost !== null && this.isLive(this.lastHeld)) {
            this.startSnap(this.lastHeld, this._ghost);
        }
        this.lastHeld = held;
        this.setGhost(held && this.isLive(held) ? this.slotFor(held) : null);
    }

    private setGhost(ghost: PlacementSlot | null): void {
        const key = (g: PlacementSlot | null) => (g ? `${g.level}-${g.slot}` : null);
        const changed = key(ghost) !== key(this._ghost);
        this._ghost = ghost;
        if (changed) this.onTargetChange?.(key(ghost));
    }

    /** Drop all state, e.g. when the tower is rebuilt. */
    forget(): void {
        this.setGhost(null);
        this.lastHeld = null;
        this.snap = null;
    }

    private isLive(body: RigidBody): boolean {
        return this.world.getRigidBody(body.handle) === body;
    }

    private slotFor(held: RigidBody): PlacementSlot | null {
        const t = held.translation();
        const slot = findPlacementSlot(this.world, t, held);
        if (!slot) return null;
        const topFace = slot.position.y - BLOCK_HEIGHT / 2;
        const horizontal = Math.hypot(t.x - slot.position.x, t.z - slot.position.z);
        const above = t.y - topFace;
        return horizontal <= ASSIST_RADIUS && above > 0 && above <= ASSIST_HEIGHT ? slot : null;
    }

    private startSnap(body: RigidBody, to: PlacementSlot): void {
        // Turn the shorter way: the block is symmetric, so aim at whichever of to.yaw and to.yaw ± π is closer
        const fromYaw = foldedYaw(body.rotation());
        let targetYaw = to.yaw;
        if (targetYaw - fromYaw > Math.PI / 2) targetYaw -= Math.PI;
        if (fromYaw - targetYaw > Math.PI / 2) targetYaw += Math.PI;
        this.snap = { body, from: { ...body.translation() }, fromYaw, to: { ...to, yaw: targetYaw }, t: 0 };
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    /**
     * Move to above the slot while turning (first 60%), then lower into it. The
     * pose is set directly each step and velocities zeroed, so the block can't
     * pick up speed on the way.
     */
    private advanceSnap(dt: number): void {
        const snap = this.snap!;
        if (!this.isLive(snap.body)) {
            this.snap = null;
            return;
        }
        snap.t = Math.min(1, snap.t + dt / SNAP_SECONDS);
        const ease = (x: number) => x * x * (3 - 2 * x);
        const target = snap.to.position;
        const restY = target.y + SNAP_CLEARANCE;
        const hoverY = Math.max(snap.from.y, restY + BLOCK_HEIGHT * 0.5);
        let p: Vec3;
        if (snap.t < 0.6) {
            const k = ease(snap.t / 0.6);
            p = { x: snap.from.x + (target.x - snap.from.x) * k, y: snap.from.y + (hoverY - snap.from.y) * k, z: snap.from.z + (target.z - snap.from.z) * k };
        } else {
            const k = ease((snap.t - 0.6) / 0.4);
            p = { x: target.x, y: hoverY + (restY - hoverY) * k, z: target.z };
        }
        const yaw = snap.fromYaw + (snap.to.yaw - snap.fromYaw) * ease(Math.min(1, snap.t / 0.6));
        snap.body.setTranslation(p, true);
        snap.body.setRotation(quatFromYaw(yaw), true);
        snap.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        snap.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        if (snap.t >= 1) this.snap = null;
    }
}
