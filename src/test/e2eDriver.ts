/**
 * In-page driver for the Playwright scripted-hand tests (GAME_REVIEW.md §4-B).
 *
 * Loaded by the tests with `import('/src/test/e2eDriver.ts')` from the Vite dev
 * server, so it shares module instances with the running app: the zustand
 * store, R3F's roots and the landmark mapping. Never imported by the app.
 *
 * The MediaPipe stub installed by e2e/fixtures.ts reads `window.__e2eHand`.
 */
import { _roots } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { worldToLandmark } from '../tracking/mapping';
import { palmSizeForDepth } from '../utils/depth';
import { buildLandmarks, type Landmark, type PoseName } from './handPoses';

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

interface E2EWindow {
    __e2eHand: Landmark[] | null;
    __e2eDrop: number;
    __e2eDetectCalls: number;
}

const w = window as unknown as Window & E2EWindow;

function rootState() {
    const root = [..._roots.values()][0];
    if (!root) throw new Error('no R3F root mounted');
    return root.store.getState();
}

function videoAspect(): number {
    const video = document.querySelector('video');
    return video && video.videoHeight ? video.videoWidth / video.videoHeight : 4 / 3;
}

let current: { pose: PoseName; at: Vec3 } | null = null;

/** Landmarks that put `pose`'s thumb–index midpoint at world point `at`. */
export function landmarksFor(pose: PoseName, at: Vec3): Landmark[] {
    const { x, y, handZ } = worldToLandmark(at, rootState().camera);
    return buildLandmarks(pose, palmSizeForDepth(handZ), x, y, videoAspect());
}

export function setHand(pose: PoseName, at: Vec3): void {
    current = { pose, at: { ...at } };
    w.__e2eHand = landmarksFor(pose, at);
}

export function hideHand(): void {
    current = null;
    w.__e2eHand = null;
}

/** The next `frames` detection calls report no hand. */
export function dropFrames(frames: number): void {
    w.__e2eDrop = frames;
}

export function detectCalls(): number {
    return w.__e2eDetectCalls;
}

/**
 * Move the hand in a straight line to `to` over `ms`. Both ends are converted
 * to landmarks with the camera as it is now and the landmarks are interpolated,
 * like a real hand: if the virtual camera moves meanwhile, the virtual hand
 * moves with it (the mapping is camera-relative).
 */
export function moveHand(pose: PoseName, to: Vec3, ms: number): Promise<void> {
    const from = landmarksFor(pose, current?.at ?? to);
    const target = landmarksFor(pose, to);
    current = { pose, at: { ...to } };
    const start = performance.now();
    return new Promise((resolve) => {
        const tick = () => {
            const k = Math.min(1, (performance.now() - start) / ms);
            w.__e2eHand = from.map((a, i) => ({
                x: a.x + (target[i].x - a.x) * k,
                y: a.y + (target[i].y - a.y) * k,
                z: 0,
            }));
            if (k < 1) requestAnimationFrame(tick);
            else resolve();
        };
        tick();
    });
}

export function store() {
    return useGameStore.getState();
}

export function cameraPosition(): Vec3 {
    const p = rootState().camera.position;
    return { x: p.x, y: p.y, z: p.z };
}

/** World position of every block, keyed by id ("2-0"). */
export function blockPositions(): Record<string, Vec3> {
    const out: Record<string, Vec3> = {};
    const v = new THREE.Vector3();
    if (_roots.size === 0) return out;
    rootState().scene.traverse((o) => {
        if (o.name.startsWith('block-')) {
            o.getWorldPosition(v);
            out[o.name.slice('block-'.length)] = { x: v.x, y: v.y, z: v.z };
        }
    });
    return out;
}

/** World positions of the rendered hand joints (debugging aid). */
export function handJointPositions(): Vec3[] {
    const out: Vec3[] = [];
    const v = new THREE.Vector3();
    rootState().scene.traverse((o) => {
        const geometry = (o as THREE.Mesh).geometry;
        if (geometry instanceof THREE.SphereGeometry && geometry.parameters.radius === 0.05) {
            o.getWorldPosition(v);
            out.push({ x: v.x, y: v.y, z: v.z });
        }
    });
    return out;
}

/** R3F clock time, to check the render loop is alive. */
export function clockTime(): number {
    return rootState().clock.elapsedTime;
}

export function frames(n: number): Promise<void> {
    return new Promise((resolve) => {
        let left = n;
        const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
    });
}
