/**
 * Headless replica of the app's physics world (GAME_REVIEW.md §4-A).
 *
 * Mirrors what <Physics>, <Floor>, <Table>, <Tower>/<Block> and <Hand> create
 * through @react-three/rapier 2.2, using the same Rapier build (0.19.2), the
 * same integration parameters and the shared constants in src/game/config.ts.
 * Gameplay logic (grab, rules) is imported from src/game, never re-implemented.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import {
    BLOCK_FRICTION,
    BLOCK_HALF_EXTENTS,
    FLOOR_FRICTION,
    FLOOR_HALF_EXTENTS,
    FLOOR_POSITION,
    GRAVITY,
    HAND_JOINT_COUNT,
    HAND_PARKING_POSITION,
    INDEX_TIP,
    PHYSICS_TIMESTEP,
    RESTITUTION,
    TABLE_FRICTION,
    TABLE_HALF_EXTENTS,
    TABLE_POSITION,
    THUMB_TIP,
} from '../../src/game/config';
import { createRng, generateTowerLayout, type BlockLayout } from '../../src/game/towerLayout';
import { HandPhysics, type BlockUserData, type HandInput, type Vec3 } from '../../src/game/grab';

let ready: Promise<void> | null = null;
export function initRapier(): Promise<void> {
    ready ??= RAPIER.init();
    return ready;
}

export interface SceneBlock extends BlockLayout {
    body: RigidBody;
    spawn: Vec3;
}

export interface Scene {
    world: World;
    rapier: typeof RAPIER;
    eventQueue: RAPIER.EventQueue;
    blocks: SceneBlock[];
    block(id: string): SceneBlock;
    floor: RigidBody;
    table: RigidBody;
    hand: HandPhysics;
    handBodies: RigidBody[];
    /** Simulated seconds since creation */
    time: number;
    /** One fixed physics step. `beforeStep` runs first, like useBeforePhysicsStep. */
    /** Runs after every physics step, like useAfterPhysicsStep. */
    afterStep: ((scene: Scene) => void) | null;
    step(beforeStep?: (scene: Scene) => void): void;
    stepFor(seconds: number, beforeStep?: (scene: Scene) => void): void;
    free(): void;
}

/** Same values @react-three/rapier 2.2 <Physics> writes into the world. */
function applyR3RIntegrationDefaults(world: World): void {
    world.integrationParameters.numSolverIterations = 4;
    world.integrationParameters.numInternalPgsIterations = 1;
    world.integrationParameters.normalizedAllowedLinearError = 0.001;
    world.integrationParameters.minIslandSize = 128;
    world.integrationParameters.maxCcdSubsteps = 1;
    world.integrationParameters.normalizedPredictionDistance = 0.002;
    world.lengthUnit = 1;
    world.integrationParameters.contact_natural_frequency = 30;
}

function createFixedBox(world: World, halfExtents: number[], position: number[], friction: number, name: string): RigidBody {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    // <RigidBody name=...> puts the name on the three.js object; collision handlers read it from there.
    body.userData = { name };
    const desc = RAPIER.ColliderDesc.cuboid(halfExtents[0], halfExtents[1], halfExtents[2])
        .setTranslation(position[0], position[1], position[2])
        .setFriction(friction)
        .setRestitution(RESTITUTION)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    world.createCollider(desc, body);
    return body;
}

function createBlock(world: World, layout: BlockLayout): RigidBody {
    const [x, y, z] = layout.position;
    const [rx, ry, rz] = layout.rotation;
    const q = eulerToQuaternion(rx, ry, rz);
    const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setRotation(q).setCanSleep(true),
    );
    // Same as <Block userData={{ blockId }}> in the app.
    body.userData = { blockId: layout.id } satisfies BlockUserData;
    const desc = RAPIER.ColliderDesc.cuboid(...BLOCK_HALF_EXTENTS)
        .setFriction(BLOCK_FRICTION)
        .setRestitution(RESTITUTION)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    world.createCollider(desc, body);
    return body;
}

function createHandBodies(world: World): RigidBody[] {
    const [px, py, pz] = HAND_PARKING_POSITION;
    return Array.from({ length: HAND_JOINT_COUNT }, () => {
        // No colliders: only HandPhysics' fingertip touches blocks (G-3)
        return world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(px, py, pz));
    });
}

export function eulerToQuaternion(x: number, y: number, z: number): { x: number; y: number; z: number; w: number } {
    // XYZ order, matching three.js Euler default
    const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
    const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
    return {
        x: s1 * c2 * c3 + c1 * s2 * s3,
        y: c1 * s2 * c3 - s1 * c2 * s3,
        z: c1 * c2 * s3 + s1 * s2 * c3,
        w: c1 * c2 * c3 - s1 * s2 * s3,
    };
}

export async function createScene({ seed = 1 }: { seed?: number } = {}): Promise<Scene> {
    await initRapier();
    const world = new RAPIER.World({ x: GRAVITY[0], y: GRAVITY[1], z: GRAVITY[2] });
    applyR3RIntegrationDefaults(world);
    const eventQueue = new RAPIER.EventQueue(true);

    const floor = createFixedBox(world, FLOOR_HALF_EXTENTS, FLOOR_POSITION, FLOOR_FRICTION, 'floor');
    const table = createFixedBox(world, TABLE_HALF_EXTENTS, TABLE_POSITION, TABLE_FRICTION, 'table');

    const blocks: SceneBlock[] = generateTowerLayout(createRng(seed)).map((layout) => {
        const body = createBlock(world, layout);
        const t = body.translation();
        return { ...layout, body, spawn: { x: t.x, y: t.y, z: t.z } };
    });
    const byId = new Map(blocks.map((b) => [b.id, b]));

    const handBodies = createHandBodies(world);
    const hand = new HandPhysics(world, RAPIER, () => handBodies);

    const scene: Scene = {
        world,
        rapier: RAPIER,
        eventQueue,
        blocks,
        afterStep: null,
        block: (id) => {
            const b = byId.get(id);
            if (!b) throw new Error(`no block ${id}`);
            return b;
        },
        floor,
        table,
        hand,
        handBodies,
        time: 0,
        step(beforeStep) {
            beforeStep?.(scene);
            // Same as Hand's useBeforePhysicsStep
            hand.beforeStep();
            world.timestep = PHYSICS_TIMESTEP;
            world.step(eventQueue);
            scene.time += PHYSICS_TIMESTEP;
            scene.afterStep?.(scene);
        },
        stepFor(seconds, beforeStep) {
            const n = Math.round(seconds / PHYSICS_TIMESTEP);
            for (let i = 0; i < n; i++) scene.step(beforeStep);
        },
        free() {
            eventQueue.free();
            world.free();
        },
    };
    return scene;
}

/**
 * A plausible 21-joint hand around a pinch point. The hand trails behind the
 * pinch along `back` (towards the player), so only the thumb and index tips are
 * near the target; the other joints sit 1–4 units back.
 */
export function handJoints(pinch: Vec3, back: Vec3 = { x: 0, y: 0, z: 1 }, tipGap = 0.3): Vec3[] {
    const joints: Vec3[] = [];
    for (let i = 0; i < HAND_JOINT_COUNT; i++) {
        // Spread the remaining joints on a small fan behind the pinch point.
        const finger = Math.floor((i - 1) / 4); // 0 thumb … 4 pinky
        const knuckle = (i - 1) % 4; // 0 base … 3 tip
        const depth = i === 0 ? 4 : 1 + (3 - knuckle) * 0.8;
        const lateral = (finger - 2) * 0.6;
        joints.push({
            x: pinch.x + back.x * depth + (back.z !== 0 ? lateral : 0),
            y: pinch.y + back.y * depth - 0.5,
            z: pinch.z + back.z * depth + (back.x !== 0 ? lateral : 0),
        });
    }
    joints[THUMB_TIP] = { x: pinch.x, y: pinch.y - tipGap / 2, z: pinch.z };
    joints[INDEX_TIP] = { x: pinch.x, y: pinch.y + tipGap / 2, z: pinch.z };
    return joints;
}

export function handInput(pinch: Vec3, pinching: boolean, back?: Vec3, tipGap?: number): HandInput {
    return { joints: handJoints(pinch, back, tipGap), pinching, openPalm: false };
}

export function distance(a: Vec3, b: Vec3): number {
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Largest displacement from spawn among `blocks`. */
export function maxShift(blocks: SceneBlock[]): number {
    return blocks.reduce((m, b) => Math.max(m, distance(b.body.translation(), b.spawn)), 0);
}
