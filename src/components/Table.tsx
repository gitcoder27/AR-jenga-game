import { RigidBody } from '@react-three/rapier'
import { TABLE_FRICTION, TABLE_HALF_EXTENTS, TABLE_POSITION, RESTITUTION } from '../game/config'

export default function Table() {
    return (
        <RigidBody type="fixed" friction={TABLE_FRICTION} restitution={RESTITUTION} name="table">
            <mesh position={TABLE_POSITION}>
                <boxGeometry args={[TABLE_HALF_EXTENTS[0] * 2, TABLE_HALF_EXTENTS[1] * 2, TABLE_HALF_EXTENTS[2] * 2]} />
                <meshStandardMaterial color="#8B4513" />
            </mesh>
        </RigidBody>
    )
}
