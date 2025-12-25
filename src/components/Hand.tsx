import { useRef } from 'react'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { useFrame } from '@react-three/fiber'
import { Mesh } from 'three'
import { normalizeCoordinates } from '../utils/coordinates'
import { calculateDepth } from '../utils/depth'
import { lerp } from '../utils/smoothing'

interface HandProps {
    result: HandLandmarkerResult | null
}

export default function Hand({ result }: HandProps) {
    const refs = useRef<(Mesh | null)[]>([])
    
    if (!result || !result.landmarks || result.landmarks.length === 0) return null

    return (
        <group>
            {Array.from({ length: 21 }).map((_, i) => (
                <mesh key={i} ref={el => (refs.current[i] = el)}>
                    <sphereGeometry args={[0.1, 16, 16]} />
                    <meshStandardMaterial color="hotpink" />
                </mesh>
            ))}
            <UpdateLogic result={result} refs={refs} />
        </group>
    )
}

function UpdateLogic({ result, refs }: { result: HandLandmarkerResult, refs: React.MutableRefObject<(Mesh | null)[]> }) {
    useFrame(() => {
        if (!result.landmarks || result.landmarks.length === 0) return

        const landmarks = result.landmarks[0]
        const handZ = calculateDepth(landmarks)
        const smoothingFactor = 0.5 // Adjust for responsiveness vs smoothness

        landmarks.forEach((landmark, index) => {
            const mesh = refs.current[index]
            if (mesh) {
                const { x, y } = normalizeCoordinates(landmark.x, landmark.y)
                
                // Use calculated depth for Z, plus relative Z from landmark if we want 3D shape
                // MP Z is normalized roughly to image width.
                // Let's add relative Z to keep hand shape
                const z = handZ + (landmark.z * -5) // Scale MP Z? And invert? MP Z: negative is forward (away from camera). 
                // Wait, in MP, Z is origin at wrist. Negative Z is "towards camera" relative to wrist plane?
                // Docs: "Z represents the landmark depth with the origin at the wrist depth. Smaller value is closer to the camera."
                // Three.js: Positive Z is closer to camera.
                // So MP Z (smaller = closer) matches Three.js Z (larger = closer)? No.
                // MP: -0.1 is closer than 0.
                // Three: 1 is closer than 0 (if cam at 5 looking at 0).
                // So we need to invert MP Z. (-landmark.z)
                
                const targetZ = handZ + (landmark.z * -10); // Scale factor guess

                mesh.position.x = lerp(mesh.position.x, x, smoothingFactor)
                mesh.position.y = lerp(mesh.position.y, y, smoothingFactor)
                mesh.position.z = lerp(mesh.position.z, targetZ, smoothingFactor)
            }
        })
    })
    return null
}
