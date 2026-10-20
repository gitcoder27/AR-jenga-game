import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import useGesture from '../hooks/useGesture';

interface GestureOrbitControllerProps {
    result: HandLandmarkerResult | null;
    controlsRef: React.RefObject<OrbitControlsImpl | null>;
    /** Video width / height, for the gesture classifier */
    aspect?: number;
}

const SENSITIVITY = 15; // Adjustment factor for orbit speed

export default function GestureOrbitController({ result, controlsRef, aspect = 1 }: GestureOrbitControllerProps) {
    const { isOpenPalm } = useGesture(result?.landmarks?.[0], aspect);
    const previousPalmPos = useRef<{ x: number; y: number } | null>(null);

    useFrame(() => {
        if (!controlsRef.current) return;

        if (isOpenPalm && result?.landmarks?.[0]) {
            const currentPalm = result.landmarks[0][0]; // Wrist position (landmark 0)

            if (previousPalmPos.current) {
                // Calculate delta (inverted X for natural feel in mirror view)
                const deltaX = currentPalm.x - previousPalmPos.current.x;
                const deltaY = currentPalm.y - previousPalmPos.current.y;

                // Apply to orbit controls
                // getAzimuthalAngle: horizontal rotation
                // getPolarAngle: vertical rotation

                const currentAzimuth = controlsRef.current.getAzimuthalAngle();
                const currentPolar = controlsRef.current.getPolarAngle();

                // Adjust angles based on delta
                // Inverted for natural mirror-mode feel:
                // Moving hand left (decreased x) rotates camera left
                controlsRef.current.setAzimuthalAngle(currentAzimuth + deltaX * SENSITIVITY);
                controlsRef.current.setPolarAngle(currentPolar - deltaY * SENSITIVITY);

                controlsRef.current.update();
            }

            previousPalmPos.current = { x: currentPalm.x, y: currentPalm.y };
        } else {
            // Reset when fist is opened or lost
            previousPalmPos.current = null;
        }
    });

    return null;
}
