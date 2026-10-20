import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import { BLOCK_HEIGHT, BLOCKS_PER_LEVEL, TOWER_FOOTPRINT } from './config';
import { blockIdOf } from './grab';
import { levelCenterY } from './towerLayout';

/** A tower block whose centre drops this far below its level has fallen (C-4). */
export const FOUL_DROP = BLOCK_HEIGHT / 2;
/** …or whose centre is this far outside the footprint (past the edge, an unheld block tips off). */
export const FOUL_OUTSIDE = 0.25;
/** The moved block has been dropped off the table once its centre is below this. */
export const DROPPED_BELOW_Y = -1;
/** Rules run at most this often (Hz). */
export const RULES_RATE = 10;
/** Speeds under which a block counts as at rest. */
export const REST_LINEAR_SPEED = 0.05;
export const REST_ANGULAR_SPEED = 0.1;
/** A placed block scores after the whole tower stays at rest this long (C-1). */
export const SETTLE_SECONDS = 3;

/**
 * - IDLE: no block is being moved this turn.
 * - HOLDING: the player holds the moving block.
 * - MOVED: the moving block was let go but is not on top of the tower.
 * - SETTLING: the moving block was let go on top; waiting for the tower to settle.
 */
export type MovePhase = 'IDLE' | 'HOLDING' | 'MOVED' | 'SETTLING';
export type FoulReason = 'block-fell' | 'dropped';

export interface MoveListeners {
    onPhaseChange?: (phase: MovePhase, movingId: string | null) => void;
    onScore?: (blockId: string) => void;
    onFoul?: (reason: FoulReason, blockId: string) => void;
}

/** Level a block id starts on: "7-1" → 7. */
function spawnLevel(id: string): number {
    return Number.parseInt(id, 10);
}

/**
 * The move lifecycle and rule-based fouls (C-1, C-4). Runs on the physics
 * world after each step; independent of floor contact.
 *
 *   IDLE → HOLDING(block) → MOVED ⇄ HOLDING → SETTLING → score → IDLE
 *
 * A foul is any block other than the moving one leaving its level (dropping
 * FOUL_DROP below it, or FOUL_OUTSIDE beyond the footprint), or the moving
 * block falling off the table. A block placed on top joins the tower at its
 * new level once it scores.
 */
export class MoveTracker {
    private levels = new Map<string, number>();
    private _phase: MovePhase = 'IDLE';
    private _movingId: string | null = null;
    private heldId: string | null = null;
    private sinceCheck = 0;
    private settledFor = 0;
    private fouled = false;
    private readonly listeners: MoveListeners;

    constructor(listeners: MoveListeners = {}) {
        this.listeners = listeners;
    }

    get phase(): MovePhase {
        return this._phase;
    }

    get movingId(): string | null {
        return this._movingId;
    }

    get hasFouled(): boolean {
        return this.fouled;
    }

    /** The level a block belongs to now (its spawn level until it is placed on top). */
    levelOf(id: string): number {
        return this.levels.get(id) ?? spawnLevel(id);
    }

    /** The highest level with a block in it. */
    topLevel(): number {
        let top = -1;
        for (const id of this.levels.keys()) top = Math.max(top, this.levelOf(id));
        return top;
    }

    /** Call when the hand grabs (id) or lets go (null). */
    setHeld(id: string | null): void {
        this.heldId = id;
        if (this.fouled) return;
        if (id !== null) {
            this._movingId = id;
            this.setPhase('HOLDING');
        } else if (this._movingId !== null && this._phase === 'HOLDING') {
            this.setPhase('MOVED');
        }
    }

    /** Call after every physics step with that step's length. */
    step(world: World, dt: number): void {
        if (this.fouled) return;
        this.sinceCheck += dt;
        if (this.sinceCheck < 1 / RULES_RATE) return;
        const elapsed = this.sinceCheck;
        this.sinceCheck = 0;

        const blocks: { id: string; body: RigidBody }[] = [];
        world.forEachRigidBody((body) => {
            const id = blockIdOf(body);
            if (id !== null && body.isEnabled()) blocks.push({ id, body });
        });
        for (const { id } of blocks) if (!this.levels.has(id)) this.levels.set(id, spawnLevel(id));

        let atRest = true;
        for (const { id, body } of blocks) {
            const t = body.translation();
            if (id === this._movingId) {
                if (t.y < DROPPED_BELOW_Y) return this.foul('dropped', id);
            } else {
                const outside = Math.max(Math.abs(t.x), Math.abs(t.z)) - TOWER_FOOTPRINT;
                if (levelCenterY(this.levelOf(id)) - t.y > FOUL_DROP || outside > FOUL_OUTSIDE) return this.foul('block-fell', id);
            }
            const v = body.linvel();
            const w = body.angvel();
            if (Math.hypot(v.x, v.y, v.z) > REST_LINEAR_SPEED || Math.hypot(w.x, w.y, w.z) > REST_ANGULAR_SPEED) atRest = false;
        }
        // Blocks culled by the kill plane are disabled, so they are not in `blocks`
        for (const id of this.levels.keys()) {
            if (!blocks.some((b) => b.id === id)) return this.foul(id === this._movingId ? 'dropped' : 'block-fell', id);
        }

        if (this._phase === 'MOVED' || this._phase === 'SETTLING') {
            const moving = blocks.find((b) => b.id === this._movingId);
            const onTop = moving !== undefined && this.isOnTop(moving.body);
            if (!onTop) {
                this.settledFor = 0;
                this.setPhase('MOVED');
                return;
            }
            this.setPhase('SETTLING');
            this.settledFor = atRest ? this.settledFor + elapsed : 0;
            if (this.settledFor >= SETTLE_SECONDS) this.score(moving!);
        }
    }

    /**
     * Let go on the tower: centre within the footprint and above the highest
     * full level (so a block completing a partly built top level counts).
     */
    private isOnTop(body: RigidBody): boolean {
        if (this.heldId !== null) return false;
        const t = body.translation();
        const topFace = levelCenterY(this.topFullLevelExcept(this._movingId)) + BLOCK_HEIGHT / 2;
        return t.y > topFace && Math.max(Math.abs(t.x), Math.abs(t.z)) < TOWER_FOOTPRINT;
    }

    private topFullLevelExcept(id: string | null): number {
        const counts = new Map<number, number>();
        for (const other of this.levels.keys()) {
            if (other === id) continue;
            const level = this.levelOf(other);
            counts.set(level, (counts.get(level) ?? 0) + 1);
        }
        let top = -1;
        for (const [level, count] of counts) if (count >= BLOCKS_PER_LEVEL) top = Math.max(top, level);
        return top;
    }

    private score(moving: { id: string; body: RigidBody }): void {
        const level = Math.round((moving.body.translation().y - BLOCK_HEIGHT / 2) / BLOCK_HEIGHT);
        this.levels.set(moving.id, level);
        this.settledFor = 0;
        this._movingId = null;
        this.setPhase('IDLE');
        this.listeners.onScore?.(moving.id);
    }

    private foul(reason: FoulReason, id: string): void {
        this.fouled = true;
        this.listeners.onFoul?.(reason, id);
    }

    private setPhase(phase: MovePhase): void {
        if (phase === this._phase) return;
        this._phase = phase;
        this.listeners.onPhaseChange?.(phase, this._movingId);
    }
}
