import { useRef } from 'react'
import { BoxGeometry, type Group } from 'three'
import { useFrame } from '@react-three/fiber'
import { BLOCK_HEIGHT, BLOCK_LENGTH, BLOCK_WIDTH } from '../game/config'
import type { PlacementAssist } from '../game/placement'

const BOX = new BoxGeometry(BLOCK_WIDTH, BLOCK_HEIGHT, BLOCK_LENGTH)

/**
 * The slot a held block will snap into on release (C-3): a translucent block
 * with bright edges, turned to the level's orientation. Imperative, so it
 * costs no React renders.
 */
export function PlacementGhost({ assist }: { assist: PlacementAssist }) {
    const group = useRef<Group>(null)

    useFrame(() => {
        const g = group.current
        if (!g) return
        const ghost = assist.ghost
        g.visible = ghost !== null
        if (!ghost) return
        g.position.set(ghost.position.x, ghost.position.y, ghost.position.z)
        g.rotation.set(0, ghost.yaw, 0)
    })

    return (
        <group ref={group} visible={false}>
            <mesh renderOrder={2} geometry={BOX}>
                <meshBasicMaterial color="#00e5ff" transparent opacity={0.25} depthWrite={false} />
            </mesh>
            <lineSegments renderOrder={3}>
                <edgesGeometry args={[BOX]} />
                <lineBasicMaterial color="#00e5ff" />
            </lineSegments>
        </group>
    )
}
