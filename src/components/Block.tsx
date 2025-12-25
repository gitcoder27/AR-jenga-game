import { RigidBody, type CollisionEnterPayload } from '@react-three/rapier'
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

    const handleCollision = ({ other }: CollisionEnterPayload) => {
        if (gameState !== 'PLAYING') return

        const otherName = other.rigidBodyObject?.name
        if (otherName === 'floor') {
            if (id !== heldBlockId) {
                setGameState('GAME_OVER')
            }
        }
    }

    return (
        <RigidBody 
            position={position} 
            rotation={rotation} 
            type="dynamic" 
            mass={1} 
            friction={0.8} 
            restitution={0}
            name={`block-${id}`}
            onCollisionEnter={handleCollision}
        >
            <mesh>
                <boxGeometry args={[2.5, 1.5, 7.5]} />
                <meshStandardMaterial color="#d2b48c" />
            </mesh>
        </RigidBody>
    )
}