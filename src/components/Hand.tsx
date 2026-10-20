import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, type RapierRigidBody, useBeforePhysicsStep, useRapier } from '@react-three/rapier'
import { HandBone } from './HandBone'
import { HandPhysics } from '../game/grab'
import { HAND_PARKING_POSITION } from '../game/config'
import { handToWorld } from '../tracking/mapping'
import type { TrackedHand } from '../tracking/handTracker'
import type { CameraClutch } from '../tracking/cameraClutch'
import * as THREE from 'three'
import { DepthCursor } from './DepthCursor'
import { CURSOR_COLORS } from './cursorLook'
import { PlacementGhost } from './PlacementGhost'
import { PlacementAssist } from '../game/placement'
import { useGameStore } from '../store/gameStore'

interface HandProps {
    /**
     * The filtered hand and its gesture (HandTracker): the one source every part
     * of the hand reads (H-6, H-7). A ref read every frame, so a new detection
     * doesn't re-render anything (M-1).
     */
    handRef: React.RefObject<TrackedHand | null>
    /** Camera-mode hold progress, shown on the cursor (H-2) */
    clutch: CameraClutch
}

const HAND_COLORS = {
    joint: { idle: '#cccccc', pinch: '#00e5ff', palm: '#ff9800', camera: CURSOR_COLORS.camera },
    bone: { idle: '#888888', pinch: '#00e5ff', palm: '#ff9800', camera: CURSOR_COLORS.camera },
}

const CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // Index
    [0, 9], [9, 10], [10, 11], [11, 12], // Middle
    [0, 13], [13, 14], [14, 15], [15, 16], // Ring
    [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
    [5, 9], [9, 13], [13, 17] // Palm
];


export default function Hand({ handRef, clutch }: HandProps) {
    const refs = useRef<(RapierRigidBody | null)[]>([])
    const groupRef = useRef<THREE.Group>(null)
    // Shared by all joints / all bones; recoloured in the frame loop (F-7)
    const materials = useMemo(() => ({
        joint: new THREE.MeshStandardMaterial({ color: HAND_COLORS.joint.idle, metalness: 1.0, roughness: 0.2 }),
        bone: new THREE.MeshStandardMaterial({ color: HAND_COLORS.bone.idle, metalness: 0.9, roughness: 0.1 }),
    }), [])
    useEffect(() => () => {
        materials.joint.dispose()
        materials.bone.dispose()
    }, [materials])

    useFrame(() => {
        const hand = handRef.current
        // Kept mounted to avoid "pop-in" at [0,0,0]; hidden while there is no hand
        if (groupRef.current) groupRef.current.visible = hand !== null
        const state = useGameStore.getState().isCameraMode ? 'camera'
            : hand?.gesture.isPinching ? 'pinch' : hand?.gesture.isOpenPalm ? 'palm' : 'idle'
        materials.joint.color.set(HAND_COLORS.joint[state])
        materials.bone.color.set(HAND_COLORS.bone[state])
    })

    return (
        <group ref={groupRef} visible={false}>
            {/* Joint Visuals & Physics */}
            {Array.from({ length: 21 }).map((_, i) => (
                <RigidBody
                    key={i}
                    ref={(el: RapierRigidBody | null) => { refs.current[i] = el }}
                    type="kinematicPosition"
                    // Visual only: the hand touches blocks through HandPhysics' fingertip (G-3)
                    colliders={false}
                    position={HAND_PARKING_POSITION} // Start far away
                >
                    <mesh castShadow material={materials.joint}>
                        <sphereGeometry args={[0.05, 12, 12]} />
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
                    material={materials.bone}
                />
            ))}

            <UpdateLogic handRef={handRef} refs={refs} clutch={clutch} />
        </group>
    )
}

function UpdateLogic({ handRef, refs, clutch }: { handRef: React.RefObject<TrackedHand | null>, refs: React.MutableRefObject<(RapierRigidBody | null)[]>, clutch: CameraClutch }) {
    const { world, rapier } = useRapier()
    const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera
    const worldRef = useRef<THREE.Vector3[]>([])
    // Mirror the grab (C-2) and the hover target (F-1) into the store
    const handPhysics = useMemo(
        () => new HandPhysics(world, rapier, () => refs.current, {
            onHeldChange: (id) => useGameStore.getState().setHeldBlockId(id),
            onHoverChange: (id) => useGameStore.getState().setHoveredBlockId(id),
        }),
        [world, rapier, refs],
    )
    const gameId = useGameStore((state) => state.gameId)
    // A reset remounts the tower, removing the held block and its joint (G-8).
    const assist = useMemo(
        () => new PlacementAssist(world, (target) => useGameStore.getState().setPlacementTarget(target)),
        [world],
    )
    useEffect(() => {
        handPhysics.forget()
        assist.forget()
    }, [gameId, handPhysics, assist])
    // Unmount: the Physics world may already be gone, so drop the grab without touching Rapier.
    useEffect(() => () => {
        handPhysics.forget()
        useGameStore.getState().setHeldBlockId(null)
        useGameStore.getState().setHoveredBlockId(null)
    }, [handPhysics])
    // The soft grab's forces follow the pinch point every physics step (G-1)
    useBeforePhysicsStep(() => handPhysics.beforeStep())

    useFrame((_, delta) => {
        const hand = handRef.current
        if (!hand) {
            handPhysics.update(null, delta)
            assist.update(handPhysics.heldBody, delta)
            return
        }
        // Already filtered (HandTracker): the joints go exactly where the hand is
        const joints = handToWorld(hand.landmarks, hand.depth, camera, worldRef.current)
        const { isPinching, isClosing, isOpenPalm } = hand.gesture
        const cameraMode = useGameStore.getState().isCameraMode
        handPhysics.update({ joints, pinching: isPinching, closing: isClosing, openPalm: isOpenPalm, camera: cameraMode }, delta)
        assist.update(handPhysics.heldBody, delta)
    })
    return (
        <>
            <DepthCursor handPhysics={handPhysics} handRef={handRef} clutch={clutch} />
            <PlacementGhost assist={assist} />
        </>
    )
}
