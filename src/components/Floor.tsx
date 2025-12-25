import { RigidBody } from '@react-three/rapier'

export default function Floor() {
    return (
        <RigidBody type="fixed" friction={1} restitution={0} name="floor">
            <mesh position={[0, -5, 0]}>
                <boxGeometry args={[100, 1, 100]} />
                <meshStandardMaterial color="#333" />
            </mesh>
        </RigidBody>
    )
}