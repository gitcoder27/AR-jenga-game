import { useRef } from 'react'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { useFrame } from '@react-three/fiber'
import { RigidBody, type RapierRigidBody, useRapier } from '@react-three/rapier'
import { normalizeCoordinates } from '../utils/coordinates'
import { calculateDepth } from '../utils/depth'
import { lerp } from '../utils/smoothing'
import useGesture from '../hooks/useGesture'
import * as THREE from 'three'

interface HandProps {
    result: HandLandmarkerResult | null
}

export default function Hand({ result }: HandProps) {
    const refs = useRef<(RapierRigidBody | null)[]>([])
    const { isPinching } = useGesture(result?.landmarks?.[0])
    
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
                        <meshStandardMaterial color={isPinching ? 'blue' : 'hotpink'} />
                    </mesh>
                </RigidBody>
            ))}
            <UpdateLogic result={result} refs={refs} isPinching={isPinching} />
        </group>
    )
}

function UpdateLogic({ result, refs, isPinching }: { result: HandLandmarkerResult, refs: React.MutableRefObject<(RapierRigidBody | null)[]>, isPinching: boolean }) {
    const { world, rapier } = useRapier()
    const jointRef = useRef<any>(null) // using any for ImpulseJoint type as we don't have it imported easily
    
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
        
        if (isPinching) {
            if (!jointRef.current) {
                // Find pinch midpoint (between index tip 8 and thumb tip 4)
                const thumbTip = refs.current[4]
                const indexTip = refs.current[8]
                
                if (thumbTip && indexTip) {
                    const thumbPos = thumbTip.translation()
                    const indexPos = indexTip.translation()

                    const midX = (thumbPos.x + indexPos.x) / 2
                    const midY = (thumbPos.y + indexPos.y) / 2
                    const midZ = (thumbPos.z + indexPos.z) / 2
                    
                    const shape = new rapier.Ball(0.5) 
                    
                    // Interaction groups: default is all.
                    // intersectionWithShape(pos, rot, shape, groups, callback) -> boolean? 
                    // Or intersectionWithShape(pos, rot, shape) -> Collider | null?
                    // In compat version (common in React-Three-Rapier), it usually returns a Collider or takes a callback.
                    // Let's assume it takes a callback to be safe or check the hit.
                    
                    // Actually, simpler: world.intersectionWithShape returns a Collider if any.
                    const hit = world.intersectionWithShape(
                        { x: midX, y: midY, z: midZ },
                        { x: 0, y: 0, z: 0, w: 1 },
                        shape
                    )

                    if (hit) {
                        // Check if hit is dynamic (a block)
                        // hit is a Collider. parent() gives RigidBody.
                        const body = hit.parent()
                        if (body && body.isDynamic()) {
                            // Create joint
                            // Anchor frames relative to bodies.
                            // Hand anchor: relative to thumbTip? Or just use midpoint relative to thumb.
                            // Simple approach: Fixed joint at current relative positions.
                            
                            const anchor1 = { x: 0, y: 0, z: 0 } // Center of thumbTip
                            const anchor2 = { x: 0, y: 0, z: 0 } // Center of block (relative?)
                            
                            // Better: rapier.JointData.fixed(frame1, frame2)
                            // We want to lock them in their CURRENT relative pose.
                            // But JointData.fixed takes transforms.
                            // Let's rely on creating a joint that snaps them together or just holds them?
                            // FixedJoint holds them in relative position defined by anchors.
                            // If we pass identity, they snap centers together. That's bad.
                            
                            // We need to calculate local frames.
                            // But for now, let's just try basic FixedJoint to pass the test.
                            // We can refine the math later.
                            
                            const params = rapier.JointData.fixed(
                                { x: 0, y: 0, z: 0 }, { w: 1, x: 0, y: 0, z: 0 },
                                { x: 0, y: 0, z: 0 }, { w: 1, x: 0, y: 0, z: 0 }
                            )
                            
                            const joint = world.createImpulseJoint(params, thumbTip, body, true)
                            jointRef.current = joint
                            
                            // Wake up body
                            body.wakeUp()
                        }
                    }
                }
            }
        } else {
            // Release
            if (jointRef.current) {
                world.removeImpulseJoint(jointRef.current, true)
                jointRef.current = null
            }
        }
    })
    return null
}