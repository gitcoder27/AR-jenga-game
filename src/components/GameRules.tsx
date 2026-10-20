import { useAfterPhysicsStep } from '@react-three/rapier'
import { cullOutOfBounds } from '../game/rules'
import { useGameStore } from '../store/gameStore'

/** Per-physics-step rule checks. */
export default function GameRules() {
    useAfterPhysicsStep((world) => {
        const culled = cullOutOfBounds(world)
        if (culled.length === 0) return
        const { gameMode, gameState, setGameState } = useGameStore.getState()
        // A block falling out of the world is a foul in Classic (P-5).
        if (gameMode === 'CLASSIC' && gameState === 'PLAYING') setGameState('GAME_OVER')
    })
    return null
}
