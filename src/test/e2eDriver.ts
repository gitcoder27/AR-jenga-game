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
import { createRng, generateTowerLayout, looseBlockId } from '../game/towerLayout';
import { tutorialTarget as tutorialTargetFor } from '../game/tutorial';
import { worldToLandmark } from '../tracking/mapping';
import { handSizeForDepth } from '../utils/depth';
import { buildLandmarks, poseHandSize, type Landmark, type PoseName } from './handPoses';

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

interface E2EWindow {
    __e2eHand: Landmark[] | null;
    __e2eDrop: number;
    __e2eDropUntil: number;
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
    const { x, y, depth } = worldToLandmark(at, rootState().camera as THREE.PerspectiveCamera);
    // The same depth direction and calibration the app maps with (H-3, H-4)
    const size = handSizeForDepth(depth, useGameStore.getState().depthSettings);
    return buildLandmarks(pose, size / poseHandSize(pose), x, y, videoAspect());
}

export function setHand(pose: PoseName, at: Vec3): void {
    current = { pose, at: { ...at } };
    w.__e2eHand = landmarksFor(pose, at);
}

/**
 * `pose` with a hand size of `size` (frame heights, see handSize) and its pinch
 * point at image point (`x`, `y`): for depth calibration, which works on image
 * sizes, not world positions.
 */
export function setHandInImage(pose: PoseName, size: number, x: number, y: number): void {
    current = null;
    w.__e2eHand = buildLandmarks(pose, size / poseHandSize(pose), x, y, videoAspect());
}

export function hideHand(): void {
    current = null;
    w.__e2eHand = null;
}

/** The next `frames` detection calls report no hand. */
export function dropFrames(frames: number): void {
    w.__e2eDrop = frames;
}

/** Detection reports no hand for the next `ms` milliseconds, however many frames that is. */
export function dropFor(ms: number): void {
    w.__e2eDropUntil = performance.now() + ms;
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

/** Id of `level`'s loose block in the current tower (C-6) */
export function looseBlock(level: number): string {
    return looseBlockId(generateTowerLayout(createRng(useGameStore.getState().towerSeed)), level);
}

/** Id of the tutorial's glowing block in the current tower (O-1) */
export function tutorialTarget(): string {
    return tutorialTargetFor(useGameStore.getState().towerSeed);
}

export function store() {
    return useGameStore.getState();
}

export function cameraPosition(): Vec3 {
    const p = rootState().camera.position;
    return { x: p.x, y: p.y, z: p.z };
}

/** The point the orbit controls look at. */
export function orbitTarget(): Vec3 {
    const controls = rootState().controls as unknown as { target: THREE.Vector3 } | null;
    if (!controls) throw new Error('no default controls');
    return { x: controls.target.x, y: controls.target.y, z: controls.target.z };
}

/** Orbit the camera to `azimuth` (radians from +Z toward +X), keeping its polar angle and distance. */
export function setOrbitAzimuth(azimuth: number): void {
    const controls = rootState().controls as unknown as { setAzimuthalAngle(a: number): void; update(): void } | null;
    if (!controls) throw new Error('no default controls');
    controls.setAzimuthalAngle(azimuth);
    controls.update();
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
/** Each block's long axis (its local +Z) in world space. */
export function blockAxes(): Record<string, Vec3> {
    const out: Record<string, Vec3> = {};
    const q = new THREE.Quaternion();
    if (_roots.size === 0) return out;
    rootState().scene.traverse((o) => {
        if (o.name.startsWith('block-')) {
            o.getWorldQuaternion(q);
            const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
            out[o.name.slice('block-'.length)] = { x: axis.x, y: axis.y, z: axis.z };
        }
    });
    return out;
}

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

/** What's behind the table: the scene background, the studio backdrop and the floor mesh (feature #10). */
export function sceneBackground(): { kind: 'video' | 'color' | 'other' | 'none'; videoPlaying: boolean; studio: boolean; floorVisible: boolean } {
    const { scene } = rootState();
    const bg = scene.background;
    // The mirror-AR background is a canvas the webcam frames are copied to
    const video = bg instanceof THREE.CanvasTexture ? document.querySelector('video') : null;
    const kind = video ? 'video' : bg instanceof THREE.Color ? 'color' : bg ? 'other' : 'none';
    return {
        kind,
        videoPlaying: Boolean(video && !video.paused && video.readyState >= 2),
        studio: scene.getObjectByName('studio-room') !== undefined,
        floorVisible: scene.getObjectByName('floor-mesh')?.visible ?? false,
    };
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
