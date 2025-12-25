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
                    // Add collision group if needed later to filter hand-block collisions
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
    const jointRef = useRef<any>(null)
    const grabbedBodyRef = useRef<RapierRigidBody | null>(null)
    const previousDampingRef = useRef<{ linear: number, angular: number }>({ linear: 0, angular: 0 })

    useFrame(() => {
        if (!result.landmarks || result.landmarks.length === 0) return

        const landmarks = result.landmarks[0]
        const handZ = calculateDepth(landmarks)
        const smoothingFactor = 0.2 // Increased smoothing for responsiveness

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
                    
                    const hit = world.intersectionWithShape(
                        { x: midX, y: midY, z: midZ },
                        { x: 0, y: 0, z: 0, w: 1 },
                        shape
                    )

                    if (hit) {
                        const body = hit.parent()
                        if (body && body.isDynamic()) {
                            // Save original damping
                            previousDampingRef.current = {
                                linear: body.linearDamping(),
                                angular: body.angularDamping()
                            }
                            
                            // Apply high damping to stabilize
                            body.setLinearDamping(2.0)
                            body.setAngularDamping(2.0)
                            
                            // Calculate local anchors to prevent snapping
                            // We attach to Thumb (refs.current[4])
                            const thumbTrans = thumbTip.translation()
                            const thumbRot = thumbTip.rotation()
                            const bodyTrans = body.translation()
                            const bodyRot = body.rotation()
                            
                            // Convert Rapier Quats/Vectors to Three.js for math
                            const tPos = new THREE.Vector3(thumbTrans.x, thumbTrans.y, thumbTrans.z)
                            const tQuat = new THREE.Quaternion(thumbRot.x, thumbRot.y, thumbRot.z, thumbRot.w)
                            
                            const bPos = new THREE.Vector3(bodyTrans.x, bodyTrans.y, bodyTrans.z)
                            const bQuat = new THREE.Quaternion(bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w)
                            
                            // We want to lock the current relative transform.
                            // Anchor in Thumb local space: Inverse(ThumbWorld) * BodyWorld
                            // But anchors are usually points.
                            // Let's attach the centers.
                            // Anchor1 (Thumb Local) = Inverse(T) * B
                            
                            const invTQuat = tQuat.clone().invert()
                            const relativePos = bPos.clone().sub(tPos).applyQuaternion(invTQuat)
                            const relativeRot = invTQuat.clone().multiply(bQuat)
                            
                            const anchor1 = { x: relativePos.x, y: relativePos.y, z: relativePos.z }
                            const orientation1 = { x: relativeRot.x, y: relativeRot.y, z: relativeRot.z, w: relativeRot.w }
                            
                            // Anchor2 (Body Local) = Identity (Center of body)
                            const anchor2 = { x: 0, y: 0, z: 0 }
                            const orientation2 = { x: 0, y: 0, z: 0, w: 1 }

                            const params = rapier.JointData.fixed(
                                anchor1, orientation1,
                                anchor2, orientation2
                            )
                            
                            // Disable collision between connected bodies
                            params.collideConnected = false 

                            const joint = world.createImpulseJoint(params, thumbTip, body, true)
                            jointRef.current = joint
                            grabbedBodyRef.current = body
                            
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
                
                // Restore damping
                if (grabbedBodyRef.current) {
                    // Slight delay or immediate? Immediate.
                    grabbedBodyRef.current.setLinearDamping(previousDampingRef.current.linear)
                    grabbedBodyRef.current.setAngularDamping(previousDampingRef.current.angular)
                    grabbedBodyRef.current.wakeUp()
                    grabbedBodyRef.current = null
                }
            }
        }
    })
    return null
}
