import { RigidBody } from '@react-three/rapier'
import { FLOOR_FRICTION, FLOOR_HALF_EXTENTS, FLOOR_POSITION, RESTITUTION } from '../game/config'

export default function Floor() {
    return (
        <RigidBody type="fixed" friction={FLOOR_FRICTION} restitution={RESTITUTION} name="floor">
            <mesh position={FLOOR_POSITION} receiveShadow>
                <boxGeometry args={[FLOOR_HALF_EXTENTS[0] * 2, FLOOR_HALF_EXTENTS[1] * 2, FLOOR_HALF_EXTENTS[2] * 2]} />
                <meshStandardMaterial color="#333" />
            </mesh>
        </RigidBody>
    )
}