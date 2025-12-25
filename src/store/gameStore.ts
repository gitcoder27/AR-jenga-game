import { create } from 'zustand'

export type GameState = 'PLAYING' | 'GAME_OVER'
export type GameMode = 'MENU' | 'CLASSIC' | 'SANDBOX'

interface GameStore {
    gameMode: GameMode
    gameState: GameState
    score: number
    heldBlockId: string | null
    gameId: number
    isWebcamVisible: boolean
    isInstructionsVisible: boolean
    setGameState: (state: GameState) => void
    startGame: (mode: GameMode) => void
    returnToMenu: () => void
    incrementScore: () => void
    setHeldBlockId: (id: string | null) => void
    setWebcamVisible: (visible: boolean) => void
    setInstructionsVisible: (visible: boolean) => void
    resetGame: () => void
}

export const useGameStore = create<GameStore>((set) => ({
    gameMode: 'MENU',
    gameState: 'PLAYING',
    score: 0,
    heldBlockId: null,
    gameId: 0,
    isWebcamVisible: false,
    isInstructionsVisible: false,
    setGameState: (gameState) => set({ gameState }),
    startGame: (gameMode) => set({
        gameMode,
        gameState: 'PLAYING',
        score: 0,
        heldBlockId: null,
        isInstructionsVisible: true
    }),
    returnToMenu: () => set({ gameMode: 'MENU', gameState: 'PLAYING' }),
    incrementScore: () => set((state) => ({ score: state.score + 1 })),
    setHeldBlockId: (heldBlockId) => set({ heldBlockId }),
    setWebcamVisible: (isWebcamVisible) => set({ isWebcamVisible }),
    setInstructionsVisible: (isInstructionsVisible) => set({ isInstructionsVisible }),
    resetGame: () => set((state) => ({
        gameState: 'PLAYING',
        score: 0,
        heldBlockId: null,
        gameId: state.gameId + 1,
        isInstructionsVisible: state.gameMode === 'CLASSIC'
    })),
}))