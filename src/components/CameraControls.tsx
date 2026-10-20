import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useGameStore } from '../store/gameStore'
import {
    CAMERA_MAX_DISTANCE,
    CAMERA_MAX_POLAR_ANGLE,
    CAMERA_MIN_DISTANCE,
    CAMERA_MIN_POLAR_ANGLE,
    CAMERA_POSITION,
    CAMERA_TARGET,
} from '../game/config'

interface CameraControlsProps {
    controlsRef: React.RefObject<OrbitControlsImpl | null>
}

/**
 * Mouse/touch orbit, limited so the camera stays above the table and the tower
 * stays within the hand's reach; no panning (V-2). The gesture orbit drives the
 * same controls, so the same limits apply. resetView() restores the default framing.
 */
export default function CameraControls({ controlsRef }: CameraControlsProps) {
    const camera = useThree((state) => state.camera)
    const viewResetId = useGameStore((state) => state.viewResetId)

    useEffect(() => {
        if (viewResetId === 0) return
        camera.position.set(...CAMERA_POSITION)
        controlsRef.current?.target.set(...CAMERA_TARGET)
        controlsRef.current?.update()
    }, [viewResetId, camera, controlsRef])

    return (
        <OrbitControls
            ref={controlsRef}
            makeDefault
            target={CAMERA_TARGET}
            enablePan={false}
            minDistance={CAMERA_MIN_DISTANCE}
            maxDistance={CAMERA_MAX_DISTANCE}
            minPolarAngle={CAMERA_MIN_POLAR_ANGLE}
            maxPolarAngle={CAMERA_MAX_POLAR_ANGLE}
        />
    )
}
