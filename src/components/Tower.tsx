import { useMemo } from 'react'
import { Instances } from '@react-three/drei'
import Block from './Block'
import { WoodMaterial } from './materials/WoodMaterial'
import { generateTowerLayout } from '../game/towerLayout'
import { BLOCK_HEIGHT, BLOCK_LENGTH, BLOCK_WIDTH, TOWER_BLOCK_COUNT } from '../game/config'

export default function Tower() {
    const blocks = useMemo(() => generateTowerLayout(), []);

    return (
        <Instances range={TOWER_BLOCK_COUNT} castShadow receiveShadow>
            <boxGeometry args={[BLOCK_WIDTH, BLOCK_HEIGHT, BLOCK_LENGTH]} />
            <WoodMaterial />
            {blocks.map(b => (
                <Block key={b.id} id={b.id} position={b.position} rotation={b.rotation} />
            ))}
        </Instances>
    )
}
