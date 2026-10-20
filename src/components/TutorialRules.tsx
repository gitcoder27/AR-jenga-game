import { useRef } from 'react'
import { useAfterPhysicsStep } from '@react-three/rapier'
import { blockIdOf } from '../game/grab'
import { isPulledOut } from '../game/tutorial'
import { RULES_RATE } from '../game/moves'
import { PHYSICS_TIMESTEP } from '../game/config'
import { useGameStore } from '../store/gameStore'

/**
 * The tutorial's pull step (O-1) ends when the block being moved is mostly
 * out of the tower: that needs its position, so it is checked here, on the
 * physics world, at the rules rate.
 */
export default function TutorialRules() {
    const since = useRef(0)

    useAfterPhysicsStep((world) => {
        const { tutorialStep, movingBlockId, setTutorialStep } = useGameStore.getState()
        if (tutorialStep !== 'pull' || !movingBlockId) return
        since.current += PHYSICS_TIMESTEP
        if (since.current < 1 / RULES_RATE) return
        since.current = 0
        world.forEachRigidBody((body) => {
            if (blockIdOf(body) === movingBlockId && isPulledOut(body.translation())) setTutorialStep('place')
        })
    })
    return null
}
