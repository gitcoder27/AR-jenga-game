import { useState, useEffect, useMemo } from 'react'
import { RigidBody, CuboidCollider, type CollisionEnterPayload } from '@react-three/rapier'
import { Instance } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'

interface BlockProps {
    id: string
    position: [number, number, number]
    rotation: [number, number, number]
}

export default function Block({ id, position, rotation }: BlockProps) {
    const setGameState = useGameStore((state) => state.setGameState)
    const heldBlockId = useGameStore((state) => state.heldBlockId)
    const gameState = useGameStore((state) => state.gameState)
    const gameMode = useGameStore((state) => state.gameMode)
    const [isSafe, setIsSafe] = useState(false)

    // Generate random shade variation per block
    const color = useMemo(() => {
        const base = new THREE.Color("#E3C099")
        // Vary HSL slightly: Lightness +/- 10%
        base.offsetHSL(0, 0, (Math.random() - 0.5) * 0.2)
        return base
    }, [])

    useEffect(() => {
        if (heldBlockId === id) {
            setIsSafe(true)
        }
    }, [heldBlockId, id])

    const handleCollision = ({ other }: CollisionEnterPayload) => {
        if (gameState !== 'PLAYING') return

        const otherName = other.rigidBodyObject?.name
        if (otherName === 'floor') {
            if (id !== heldBlockId && !isSafe && gameMode === 'CLASSIC') {
                setGameState('GAME_OVER')
            }
        }
    }

    return (
        <RigidBody
            position={position}
            rotation={rotation}
            type="dynamic"
            mass={2}
            friction={1}
            restitution={0}
            name={`block-${id}`}
            onCollisionEnter={handleCollision}
            canSleep={true}
            colliders={false} // Disable auto-colliders to be safe
        >
            <CuboidCollider args={[1.25, 0.75, 3.75]} />
            <Instance color={color} />
        </RigidBody>
    )
}