import { useRef } from 'react'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { useFrame } from '@react-three/fiber'
import { RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { normalizeCoordinates } from '../utils/coordinates'
import { calculateDepth } from '../utils/depth'
import { lerp } from '../utils/smoothing'

interface HandProps {
    result: HandLandmarkerResult | null
}

export default function Hand({ result }: HandProps) {
    const refs = useRef<(RapierRigidBody | null)[]>([])
    
    if (!result || !result.landmarks || result.landmarks.length === 0) return null

    return (
        <group>
            {Array.from({ length: 21 }).map((_, i) => (
                <RigidBody 
                    key={i} 
                    ref={el => (refs.current[i] = el)}
                    type="kinematicPosition"
                    colliders="ball"
                >
                    <mesh>
                        <sphereGeometry args={[0.1, 16, 16]} />
                        <meshStandardMaterial color="hotpink" />
                    </mesh>
                </RigidBody>
            ))}
            <UpdateLogic result={result} refs={refs} />
        </group>
    )
}

function UpdateLogic({ result, refs }: { result: HandLandmarkerResult, refs: React.MutableRefObject<(RapierRigidBody | null)[]> }) {
    useFrame(() => {
        if (!result.landmarks || result.landmarks.length === 0) return

        const landmarks = result.landmarks[0]
        const handZ = calculateDepth(landmarks)
        const smoothingFactor = 0.1 

        landmarks.forEach((landmark, index) => {
            const rb = refs.current[index]
            if (rb) {
                const { x, y } = normalizeCoordinates(landmark.x, landmark.y)
                const targetZ = handZ + (landmark.z * -10);

                const currentPos = rb.translation()
                
                const newX = lerp(currentPos.x, x, smoothingFactor)
                const newY = lerp(currentPos.y, y, smoothingFactor)
                const newZ = lerp(currentPos.z, targetZ, smoothingFactor)
                
                rb.setNextKinematicTranslation({ x: newX, y: newY, z: newZ })
            }
        })
    })
    return null
}