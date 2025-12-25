import { RigidBody } from '@react-three/rapier'

export default function Floor() {
    return (
        <RigidBody type="fixed" friction={1} restitution={0}>
            <mesh position={[0, -1, 0]}>
                <boxGeometry args={[50, 2, 50]} />
                <meshStandardMaterial color="#333" />
            </mesh>
        </RigidBody>
    )
}