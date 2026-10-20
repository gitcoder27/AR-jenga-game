import { useMemo, useRef } from 'react'
import { RigidBody, CuboidCollider, type CollisionEnterPayload, type RapierRigidBody } from '@react-three/rapier'
import { Instance } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { BLOCK_FRICTION, BLOCK_HALF_EXTENTS, RESTITUTION } from '../game/config'
import type { BlockUserData } from '../game/grab'

interface BlockProps {
    id: string
    position: [number, number, number]
    rotation: [number, number, number]
}

// Highlight color for hovered blocks
const HIGHLIGHT_COLOR = new THREE.Color('#00e5ff')
const HIGHLIGHT_INTENSITY = 0.4

export default function Block({ id, position, rotation }: BlockProps) {
    const setGameState = useGameStore((state) => state.setGameState)
    const isHeld = useGameStore((state) => state.heldBlockId === id)
    const isMoving = useGameStore((state) => state.movingBlockId === id)
    const hoveredBlockId = useGameStore((state) => state.hoveredBlockId)
    const gameState = useGameStore((state) => state.gameState)
    const gameMode = useGameStore((state) => state.gameMode)
    const meshRef = useRef<THREE.Mesh>(null)
    const rigidBodyRef = useRef<RapierRigidBody>(null)

    // Is this block currently being hovered?
    const isHovered = hoveredBlockId === `block-${id}`
    const userData = useMemo<BlockUserData>(() => ({ blockId: id }), [id])

    // Generate random shade variation per block
    const baseColor = useMemo(() => {
        const base = new THREE.Color("#E3C099")
        // Vary HSL slightly: Lightness +/- 10%
        base.offsetHSL(0, 0, (Math.random() - 0.5) * 0.2)
        return base
    }, [])

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

    const handleCollision = ({ other }: CollisionEnterPayload) => {
        if (gameState !== 'PLAYING') return

        const otherName = other.rigidBodyObject?.name
        if (otherName === 'floor') {
            // The block being moved this turn may be dropped; anything else on the floor ends the game.
            if (!isMoving && gameMode === 'CLASSIC') {
                setGameState('GAME_OVER')
            }
        }
    }

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
            onCollisionEnter={handleCollision}
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