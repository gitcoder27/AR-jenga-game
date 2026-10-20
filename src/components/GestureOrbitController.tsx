import { useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { TrackedHand } from '../tracking/handTracker';
import { OrbitDrive, palmCentre } from '../tracking/cameraClutch';
import { useGameStore } from '../store/gameStore';

interface GestureOrbitControllerProps {
    /** The filtered hand and its gesture, shared with Hand (H-7), read every frame (M-1) */
    handRef: React.RefObject<TrackedHand | null>;
    controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

/**
 * Turns the view with the hand, only in camera mode (H-2). Entering and leaving
 * it is CameraClutch's job (or the HUD's); this only follows the palm while it
 * is on. The OrbitControls' polar and distance limits apply (V-2).
 */
export default function GestureOrbitController({ handRef, controlsRef }: GestureOrbitControllerProps) {
    const [orbit] = useState(() => new OrbitDrive());

    useFrame((_, delta) => {
        const controls = controlsRef.current;
        if (!controls) return;
        const hand = handRef.current;
        // Read, not subscribed: entering camera mode needn't re-render this
        if (!useGameStore.getState().isCameraMode || !hand) {
            orbit.reset();
            return;
        }
        const { azimuth, polar } = orbit.update(palmCentre(hand.landmarks), delta);
        if (azimuth === 0 && polar === 0) return;
        // Applied in full, now: with damping on, OrbitControls would apply 5% per update and coast on
        // after the hand stops. OrbitDrive already smooths.
        const damping = controls.enableDamping;
        controls.enableDamping = false;
        controls.setAzimuthalAngle(controls.getAzimuthalAngle() + azimuth);
        controls.setPolarAngle(controls.getPolarAngle() + polar);
        controls.enableDamping = damping;
    });

    return null;
}
