import { RigidBody } from '@react-three/rapier'

interface BlockProps {
    position: [number, number, number]
    rotation: [number, number, number]
}

export default function Block({ position, rotation }: BlockProps) {
    return (
        <RigidBody 
            position={position} 
            rotation={rotation} 
            type="dynamic" 
            mass={1} 
            friction={0.8} 
            restitution={0}
        >
            <mesh>
                <boxGeometry args={[2.5, 1.5, 7.5]} />
                <meshStandardMaterial color="#d2b48c" />
            </mesh>
        </RigidBody>
    )
}