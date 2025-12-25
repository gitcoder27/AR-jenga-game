import { useRef } from 'react'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { useFrame } from '@react-three/fiber'
import { RigidBody, type RapierRigidBody, useRapier } from '@react-three/rapier'
import { normalizeCoordinates } from '../utils/coordinates'
import { calculateDepth } from '../utils/depth'
import { lerp } from '../utils/smoothing'
import useGesture from '../hooks/useGesture'
import { HandBone } from './HandBone'
import * as THREE from 'three'

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

const PARKING_POSITION: [number, number, number] = [0, -100, 0];

export default function Hand({ result }: HandProps) {
    const refs = useRef<(RapierRigidBody | null)[]>([])
    const { isPinching } = useGesture(result?.landmarks?.[0])
    
    // We keep the component mounted to avoid "pop-in" at [0,0,0]
    // but we hide the visuals if no result
    const isVisible = !!(result && result.landmarks && result.landmarks.length > 0);

    return (
        <group visible={isVisible}>
            {/* Joint Visuals & Physics */}
            {Array.from({ length: 21 }).map((_, i) => (
                <RigidBody 
                    key={i} 
                    ref={(el: RapierRigidBody | null) => { refs.current[i] = el }}
                    type="kinematicPosition"
                    colliders="ball"
                    position={PARKING_POSITION} // Start far away
                >
                    <mesh>
                        <sphereGeometry args={[0.05, 12, 12]} />
                        <meshStandardMaterial 
                            color={isPinching ? '#00e5ff' : '#cccccc'} 
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
                    color={isPinching ? '#00e5ff' : '#888888'}
                />
            ))}

            <UpdateLogic result={result} refs={refs} isPinching={isPinching} />
        </group>
    )
}

function UpdateLogic({ result, refs, isPinching }: { result: HandLandmarkerResult | null, refs: React.MutableRefObject<(RapierRigidBody | null)[]>, isPinching: boolean }) {
    const { world, rapier } = useRapier()
    const jointRef = useRef<any>(null)
    const grabbedBodyRef = useRef<RapierRigidBody | null>(null)
    const previousDampingRef = useRef<{ linear: number, angular: number }>({ linear: 0, angular: 0 })
    const isFirstFrameRef = useRef(true)

    useFrame(() => {
        if (!result || !result.landmarks || result.landmarks.length === 0) {
            if (!isFirstFrameRef.current) {
                // Parking the hand if lost
                refs.current.forEach(rb => {
                    if (rb) rb.setNextKinematicTranslation({ x: 0, y: -100, z: 0 });
                });
                isFirstFrameRef.current = true;
            }
            return
        }

        const landmarks = result.landmarks[0]
        const handZ = calculateDepth(landmarks)
        const smoothingFactor = 0.12

        landmarks.forEach((landmark, index) => {
            const rb = refs.current[index]
            if (rb) {
                const { x, y } = normalizeCoordinates(landmark.x, landmark.y)
                const targetZ = handZ + (landmark.z * -10);

                if (isFirstFrameRef.current) {
                    // Teleport instantly on first frame to avoid knocking tower from center
                    rb.setNextKinematicTranslation({ x, y, z: targetZ })
                } else {
                    const currentPos = rb.translation()
                    const newX = lerp(currentPos.x, x, smoothingFactor)
                    const newY = lerp(currentPos.y, y, smoothingFactor)
                    const newZ = lerp(currentPos.z, targetZ, smoothingFactor)
                    rb.setNextKinematicTranslation({ x: newX, y: newY, z: newZ })
                }
            }
        })
        
        isFirstFrameRef.current = false
        
        if (isPinching) {
            if (!jointRef.current) {
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
                            previousDampingRef.current = {
                                linear: body.linearDamping(),
                                angular: body.angularDamping()
                            }
                            
                            body.setLinearDamping(2.0)
                            body.setAngularDamping(2.0)
                            
                            const thumbTrans = thumbTip.translation()
                            const thumbRot = thumbTip.rotation()
                            const bodyTrans = body.translation()
                            const bodyRot = body.rotation()
                            
                            const tPos = new THREE.Vector3(thumbTrans.x, thumbTrans.y, thumbTrans.z)
                            const tQuat = new THREE.Quaternion(thumbRot.x, thumbRot.y, thumbRot.z, thumbRot.w)
                            const bPos = new THREE.Vector3(bodyTrans.x, bodyTrans.y, bodyTrans.z)
                            const bQuat = new THREE.Quaternion(bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w)
                            
                            const invTQuat = tQuat.clone().invert()
                            const relativePos = bPos.clone().sub(tPos).applyQuaternion(invTQuat)
                            const relativeRot = invTQuat.clone().multiply(bQuat)
                            
                            const params = rapier.JointData.fixed(
                                { x: relativePos.x, y: relativePos.y, z: relativePos.z },
                                { x: relativeRot.x, y: relativeRot.y, z: relativeRot.z, w: relativeRot.w },
                                { x: 0, y: 0, z: 0 },
                                { x: 0, y: 0, z: 0, w: 1 }
                            )
                            
                            ;(params as any).collideConnected = false 

                            const joint = world.createImpulseJoint(params, thumbTip, body, true)
                            jointRef.current = joint
                            grabbedBodyRef.current = body
                            body.wakeUp()
                        }
                    }
                }
            }
        } else {
            if (jointRef.current) {
                world.removeImpulseJoint(jointRef.current, true)
                jointRef.current = null
                
                if (grabbedBodyRef.current) {
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