import { RigidBody } from '@react-three/rapier'
import { FLOOR_FRICTION, FLOOR_HALF_EXTENTS, FLOOR_POSITION, RESTITUTION } from '../game/config'

/** `visible` hides only the mesh (behind the mirror-AR background); the ground stays */
export default function Floor({ visible = true }: { visible?: boolean }) {
    return (
        <RigidBody type="fixed" friction={FLOOR_FRICTION} restitution={RESTITUTION} name="floor">
            <mesh position={FLOOR_POSITION} receiveShadow visible={visible} name="floor-mesh">
                <boxGeometry args={[FLOOR_HALF_EXTENTS[0] * 2, FLOOR_HALF_EXTENTS[1] * 2, FLOOR_HALF_EXTENTS[2] * 2]} />
                <meshStandardMaterial color="#333" />
            </mesh>
        </RigidBody>
    )
}