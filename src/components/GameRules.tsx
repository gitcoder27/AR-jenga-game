import { useEffect, useState } from 'react'
import { useAfterPhysicsStep } from '@react-three/rapier'
import { cullOutOfBounds } from '../game/rules'
import { MoveTracker } from '../game/moves'
import { PHYSICS_TIMESTEP } from '../game/config'
import { useGameStore } from '../store/gameStore'

/**
 * Per-physics-step rules. Every mode culls blocks that fell out of the world
 * (P-5). Classic also runs the move lifecycle (C-1, C-4): it scores a block
 * placed on top once the tower settles, and ends the game the moment a tower
 * block falls. Keyed by gameId, so every game gets a fresh tracker.
 */
export default function GameRules() {
    const [tracker] = useState(() => {
        const store = useGameStore.getState
        return new MoveTracker({
            onPhaseChange: (phase, movingId) => store().setMovePhase(phase, movingId),
            onScore: () => store().scoreMove(),
            onFoul: (reason) => store().foul(reason),
        })
    })

    useEffect(() => {
        tracker.setHeld(useGameStore.getState().heldBlockId)
        return useGameStore.subscribe((state, previous) => {
            if (state.heldBlockId !== previous.heldBlockId) tracker.setHeld(state.heldBlockId)
        })
    }, [tracker])

    useAfterPhysicsStep((world) => {
        cullOutOfBounds(world)
        const { gameMode, gameState } = useGameStore.getState()
        // A culled block is missing from the world, which the tracker counts as fallen
        if (gameMode === 'CLASSIC' && gameState === 'PLAYING') tracker.step(world, PHYSICS_TIMESTEP)
    })
    return null
}
