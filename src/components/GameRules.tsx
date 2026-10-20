import { useEffect, useState } from 'react'
import { useAfterPhysicsStep } from '@react-three/rapier'
import { cullOutOfBounds } from '../game/rules'
import { MoveTracker } from '../game/moves'
import { PHYSICS_TIMESTEP } from '../game/config'
import { useGameStore } from '../store/gameStore'

function newTracker(): MoveTracker {
    const store = useGameStore.getState
    return new MoveTracker({
        onPhaseChange: (phase, movingId) => store().setMovePhase(phase, movingId),
        onScore: () => store().scoreMove(),
        onFoul: (reason) => store().foul(reason),
    })
}

/**
 * Per-physics-step rules. Every mode culls blocks that fell out of the world
 * (P-5). Classic also runs the move lifecycle (C-1, C-4): it scores a block
 * placed on top once the tower settles, and ends the game the moment a tower
 * block falls.
 *
 * Every game gets a fresh tracker, but this component stays mounted. Keyed by
 * gameId, its remount beside the Tower's let a physics step run on the new
 * tower before its bodies were in place: on every reset the blocks overlapped
 * and the tower blew apart (e2e/reset.spec.ts).
 */
export default function GameRules() {
    const gameId = useGameStore((s) => s.gameId)
    const [game, setGame] = useState(() => ({ gameId, tracker: newTracker() }))
    // A new game: a new tracker (adjusting state during render, not in an effect)
    if (game.gameId !== gameId) setGame({ gameId, tracker: newTracker() })
    const { tracker } = game

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
