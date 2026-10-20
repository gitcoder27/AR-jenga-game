import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BLOCK_HALF_EXTENTS, CAMERA_TARGET } from '../game/config';
import type { TrackedHand } from '../tracking/handTracker';
import { landmarkToWorld, pinchAnchor, worldToLandmark, type LandmarkLike } from '../tracking/mapping';
import type { DepthGaugeView } from './depthGaugeView';
import './DepthGauge.css';

/**
 * Depth gauge (H-3): a vertical bar at the screen edge, far at the top and
 * near at the bottom, with the tower's depth as a band and the hand as a
 * marker. Shown while a hand is tracked.
 */
export function DepthGauge({ view }: { view: DepthGaugeView }) {
    return (
        <div className="depth-gauge" ref={(el) => view.attach('root', el)} aria-hidden="true" style={{ visibility: 'hidden' }}>
            <span className="depth-gauge-label">FAR</span>
            <div className="depth-gauge-track">
                <div className="depth-gauge-band" ref={(el) => view.attach('band', el)} />
                <div className="depth-gauge-hand" ref={(el) => view.attach('hand', el)} />
            </div>
            <span className="depth-gauge-label">NEAR</span>
        </div>
    );
}

const anchor: LandmarkLike = { x: 0, y: 0, z: 0 };
const pinch = new THREE.Vector3();
const forward = new THREE.Vector3();
const point = new THREE.Vector3();

/** Inside the Canvas: measures the hand's and the tower's depth every frame for the gauge. */
export function DepthGaugeSync({ view, handRef }: { view: DepthGaugeView; handRef: React.RefObject<TrackedHand | null> }) {
    const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;

    useFrame(() => {
        const hand = handRef.current;
        if (!hand) return view.show(null);
        // The tower's extent along the view, at the pinch point's height
        landmarkToWorld(pinchAnchor(hand.landmarks, anchor), hand.depth, camera, pinch);
        camera.getWorldDirection(forward).setY(0).normalize();
        const reach = (Math.abs(forward.x) + Math.abs(forward.z)) * BLOCK_HALF_EXTENTS[2];
        point.set(CAMERA_TARGET[0], pinch.y, CAMERA_TARGET[2]).addScaledVector(forward, -reach);
        const front = worldToLandmark(point, camera).depth;
        point.addScaledVector(forward, 2 * reach);
        const back = worldToLandmark(point, camera).depth;
        view.show({ hand: hand.depth, front, back });
    });
    return null;
}
