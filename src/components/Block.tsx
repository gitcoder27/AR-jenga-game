import { memo, useMemo, useRef } from 'react'
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier'
import { Instance } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { BLOCK_FRICTION, BLOCK_HALF_EXTENTS, RESTITUTION } from '../game/config'
import type { BlockUserData } from '../game/grab'
import { blockShade } from '../game/towerLayout'

interface BlockProps {
    id: string
    position: [number, number, number]
    rotation: [number, number, number]
    /** Tower seed, for this block's wood shade */
    seed?: number
}

// Highlight color for hovered blocks
const HIGHLIGHT_COLOR = new THREE.Color('#00e5ff')
const HIGHLIGHT_INTENSITY = 0.4

/**
 * One tower block. Memoized, with selectors for its own held / hovered state
 * only, so a hover change re-renders just the blocks it concerns (M-1).
 */
function Block({ id, position, rotation, seed = 1 }: BlockProps) {
    const isHeld = useGameStore((state) => state.heldBlockId === id)
    const isHovered = useGameStore((state) => state.hoveredBlockId === id)
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
        return baseColor
    }, [baseColor, isHovered, isHeld])

    // Animate highlight effect
    useFrame(() => {
        if (meshRef.current) {
            // Smooth scale animation when hovered
            const targetScale = isHovered ? 1.02 : 1.0
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
            <CuboidCollider args={BLOCK_HALF_EXTENTS} />
            <group ref={meshRef}>
                <Instance color={currentColor} />
            </group>
        </RigidBody>
    )
}

export default memo(Block)
