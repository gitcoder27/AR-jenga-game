import { create } from 'zustand'

export type GameState = 'PLAYING' | 'GAME_OVER'

interface GameStore {
    gameState: GameState
    score: number
    heldBlockId: string | null
    gameId: number
    isWebcamVisible: boolean
    isInstructionsVisible: boolean
    setGameState: (state: GameState) => void
    incrementScore: () => void
    setHeldBlockId: (id: string | null) => void
    setWebcamVisible: (visible: boolean) => void
    setInstructionsVisible: (visible: boolean) => void
    resetGame: () => void
}

export const useGameStore = create<GameStore>((set) => ({
    gameState: 'PLAYING',
    score: 0,
    heldBlockId: null,
    gameId: 0,
    isWebcamVisible: false,
    isInstructionsVisible: true,
    setGameState: (gameState) => set({ gameState }),
    incrementScore: () => set((state) => ({ score: state.score + 1 })),
    setHeldBlockId: (heldBlockId) => set({ heldBlockId }),
    setWebcamVisible: (isWebcamVisible) => set({ isWebcamVisible }),
    setInstructionsVisible: (isInstructionsVisible) => set({ isInstructionsVisible }),
    resetGame: () => set((state) => ({ 
        gameState: 'PLAYING', 
        score: 0, 
        heldBlockId: null, 
        gameId: state.gameId + 1,
        isInstructionsVisible: true
    })),
}))