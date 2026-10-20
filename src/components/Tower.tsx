import { useState } from 'react'
import { Instances } from '@react-three/drei'
import Block from './Block'
import { WoodMaterial } from './materials/WoodMaterial'
import { createRng, generateTowerLayout } from '../game/towerLayout'
import { tutorialTarget } from '../game/tutorial'
import { useGameStore } from '../store/gameStore'
import { BLOCK_HEIGHT, BLOCK_LENGTH, BLOCK_WIDTH, TOWER_BLOCK_COUNT } from '../game/config'

export default function Tower() {
    // Remounted per game (key={gameId}); the layout is fixed for the tower's lifetime
    const [seed] = useState(() => useGameStore.getState().towerSeed)
    const [blocks] = useState(() => generateTowerLayout(createRng(seed)))
    const target = tutorialTarget(seed)

    return (
        <Instances range={TOWER_BLOCK_COUNT} castShadow receiveShadow>
            <boxGeometry args={[BLOCK_WIDTH, BLOCK_HEIGHT, BLOCK_LENGTH]} />
            <WoodMaterial />
            {blocks.map(b => (
                <Block key={b.id} id={b.id} position={b.position} rotation={b.rotation} size={b.size} tutorialTarget={b.id === target} seed={seed} />
            ))}
        </Instances>
    )
}
