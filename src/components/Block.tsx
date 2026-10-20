import { memo, useMemo, useRef } from 'react'
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier'
import { Instance } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { BLOCK_FRICTION, BLOCK_HEIGHT, BLOCK_LENGTH, BLOCK_WIDTH, RESTITUTION, type Vec3Tuple } from '../game/config'
import type { BlockUserData } from '../game/grab'
import { blockShade } from '../game/towerLayout'

interface BlockProps {
    id: string
    position: [number, number, number]
    rotation: [number, number, number]
    /** Full width, height and length (C-6); the instanced box is the nominal size */
    size?: Vec3Tuple
    /** The tutorial's block to touch, grab and pull out (O-1): it glows on those steps */
    tutorialTarget?: boolean
    /** Tower seed, for this block's wood shade */
    seed?: number
}

// Highlight color for hovered blocks
const HIGHLIGHT_COLOR = new THREE.Color('#00e5ff')
const HIGHLIGHT_INTENSITY = 0.4
// The tutorial's block to touch, grab and pull out (O-1)
const TUTORIAL_COLOR = new THREE.Color('#ff8f00')
const TUTORIAL_STEPS_GLOWING = ['touch', 'grab', 'pull']

/**
 * One tower block. Memoized, with selectors for its own held / hovered state
 * only, so a hover change re-renders just the blocks it concerns (M-1).
 */
const NOMINAL_SIZE: Vec3Tuple = [BLOCK_WIDTH, BLOCK_HEIGHT, BLOCK_LENGTH]

function Block({ id, position, rotation, size = NOMINAL_SIZE, tutorialTarget = false, seed = 1 }: BlockProps) {
    const isHeld = useGameStore((state) => state.heldBlockId === id)
    const isHovered = useGameStore((state) => state.hoveredBlockId === id)
    const isTutorialTarget = useGameStore((state) => tutorialTarget && TUTORIAL_STEPS_GLOWING.includes(state.tutorialStep ?? ''))
    const meshRef = useRef<THREE.Mesh>(null)
    const rigidBodyRef = useRef<RapierRigidBody>(null)

    const userData = useMemo<BlockUserData>(() => ({ blockId: id }), [id])

    // Shade variation per block: lightness +/- 10%, reproducible from the tower seed
    const baseColor = useMemo(() => new THREE.Color("#E3C099").offsetHSL(0, 0, blockShade(seed, id)), [seed, id])

    // Interpolated color for smooth highlight transition
    const currentColor = useMemo(() => {
        if (isHeld) {
            // Green when held
            return new THREE.Color('#00ff00').lerp(baseColor, 0.5)
        }
        if (isHovered) {
            // Cyan highlight when hovered
            return baseColor.clone().lerp(HIGHLIGHT_COLOR, HIGHLIGHT_INTENSITY)
        }
        if (isTutorialTarget) return TUTORIAL_COLOR
        return baseColor
    }, [baseColor, isHovered, isHeld, isTutorialTarget])

    // Animate highlight effect
    useFrame(() => {
        if (meshRef.current) {
            // Smooth scale animation when hovered; the tutorial's block pulses
            const targetScale = isHovered ? 1.02 : isTutorialTarget ? 1.01 + 0.015 * Math.sin(performance.now() / 200) : 1.0
            const currentScale = meshRef.current.scale.x
            const newScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.1)
            meshRef.current.scale.setScalar(newScale)
        }
    })

    return (
        <RigidBody
            ref={rigidBodyRef}
            position={position}
            rotation={rotation}
            type="dynamic"
            mass={2}
            friction={BLOCK_FRICTION}
            restitution={RESTITUTION}
            name={`block-${id}`}
            userData={userData}
            canSleep={true}
            colliders={false}
        >
            <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
            <group ref={meshRef}>
                <Instance color={currentColor} scale={[size[0] / BLOCK_WIDTH, size[1] / BLOCK_HEIGHT, size[2] / BLOCK_LENGTH]} />
            </group>
        </RigidBody>
    )
}

export default memo(Block)
