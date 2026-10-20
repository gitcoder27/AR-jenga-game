import { useMemo, useRef } from 'react'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, type RapierRigidBody, useRapier } from '@react-three/rapier'
import { calculateDepth } from '../utils/depth'
import { adaptiveLerp, calculateVelocity } from '../utils/smoothing'
import useGesture from '../hooks/useGesture'
import { HandBone } from './HandBone'
import { HandPhysics } from '../game/grab'
import { HAND_PARKING_POSITION } from '../game/config'
import { landmarkToWorld } from '../tracking/mapping'

interface HandProps {
    result: HandLandmarkerResult | null
}

const CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // Index
    [0, 9], [9, 10], [10, 11], [11, 12], // Middle
    [0, 13], [13, 14], [14, 15], [15, 16], // Ring
    [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
    [5, 9], [9, 13], [13, 17] // Palm
];


export default function Hand({ result }: HandProps) {
    const refs = useRef<(RapierRigidBody | null)[]>([])
    const { isPinching, isClosedFist } = useGesture(result?.landmarks?.[0])

    // We keep the component mounted to avoid "pop-in" at [0,0,0]
    // but we hide the visuals if no result
    const isVisible = !!(result && result.landmarks && result.landmarks.length > 0);

    // Determine hand color based on gesture state
    const getHandColor = () => {
        if (isPinching) return '#00e5ff'; // Cyan for pinch
        if (isClosedFist) return '#ff9800'; // Orange for closed fist
        return '#cccccc'; // Default gray
    };

    const getBoneColor = () => {
        if (isPinching) return '#00e5ff';
        if (isClosedFist) return '#ff9800';
        return '#888888';
    };

    return (
        <group visible={isVisible}>
            {/* Joint Visuals & Physics */}
            {Array.from({ length: 21 }).map((_, i) => (
                <RigidBody
                    key={i}
                    ref={(el: RapierRigidBody | null) => { refs.current[i] = el }}
                    type="kinematicPosition"
                    colliders="ball"
                    position={HAND_PARKING_POSITION} // Start far away
                >
                    <mesh>
                        <sphereGeometry args={[0.05, 12, 12]} />
                        <meshStandardMaterial
                            color={getHandColor()}
                            metalness={1.0}
                            roughness={0.2}
                        />
                    </mesh>
                </RigidBody>
            ))}

            {/* Bone Visuals */}
            {CONNECTIONS.map(([start, end], i) => (
                <HandBone
                    key={i}
                    refs={refs}
                    startIdx={start}
                    endIdx={end}
                    color={getBoneColor()}
                />
            ))}

            <UpdateLogic result={result} refs={refs} isPinching={isPinching} isClosedFist={isClosedFist} />
        </group>
    )
}

function UpdateLogic({ result, refs, isPinching, isClosedFist }: { result: HandLandmarkerResult | null, refs: React.MutableRefObject<(RapierRigidBody | null)[]>, isPinching: boolean, isClosedFist: boolean }) {
    const { world, rapier } = useRapier()
    const { camera } = useThree()
    const handPhysics = useMemo(() => new HandPhysics(world, rapier, () => refs.current), [world, rapier, refs])
    // Velocity tracking for adaptive smoothing
    const prevPositionsRef = useRef<Map<number, { x: number; y: number; z: number }>>(new Map())

    useFrame(() => {
        if (!result || !result.landmarks || result.landmarks.length === 0) {
            handPhysics.update(null)
            return
        }

        const landmarks = result.landmarks[0]
        const handZ = calculateDepth(landmarks)
        const isFirstFrame = handPhysics.isParked

        const joints = landmarks.map((landmark, index) => {
            const worldPos = landmarkToWorld(landmark, handZ, camera)
            const rb = refs.current[index]
            if (isFirstFrame || !rb) {
                // Teleport instantly on first frame to avoid knocking tower from center
                prevPositionsRef.current.set(index, { x: worldPos.x, y: worldPos.y, z: worldPos.z });
                return { x: worldPos.x, y: worldPos.y, z: worldPos.z }
            }
            const currentPos = rb.translation()
            const prevPos = prevPositionsRef.current.get(index) || currentPos;

            // Calculate velocity for adaptive smoothing
            const velocity = calculateVelocity(prevPos, worldPos);

            // Adaptive smoothing: fast movements = responsive, slow = stable
            const next = {
                x: adaptiveLerp(currentPos.x, worldPos.x, velocity),
                y: adaptiveLerp(currentPos.y, worldPos.y, velocity),
                z: adaptiveLerp(currentPos.z, worldPos.z, velocity),
            }
            prevPositionsRef.current.set(index, next);
            return next
        })

        handPhysics.update({ joints, pinching: isPinching, openPalm: isClosedFist })
    })
    return null
}
