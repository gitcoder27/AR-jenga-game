import { RigidBody } from '@react-three/rapier'

export default function Table() {
    return (
        <RigidBody type="fixed" friction={1} restitution={0} name="table">
            <mesh position={[0, -1, 0]}>
                <boxGeometry args={[10, 2, 10]} />
                <meshStandardMaterial color="#8B4513" />
            </mesh>
        </RigidBody>
    )
}
