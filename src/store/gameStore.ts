import { create } from 'zustand'

export type GameState = 'PLAYING' | 'GAME_OVER'
export type GameMode = 'MENU' | 'CLASSIC' | 'SANDBOX'
/**
 * Hand tracking lifecycle (H-9): model loading, failed, running with no hand
 * in view, or tracking a hand.
 */
export type TrackingStatus = 'loading' | 'error' | 'no-hand' | 'ready'
export type TrackingDelegate = 'GPU' | 'CPU'

interface GameStore {
    gameMode: GameMode
    gameState: GameState
    score: number
    heldBlockId: string | null
    /**
     * The block being moved this turn: set when a block is grabbed and kept after
     * release until another block is grabbed or the game resets. It is exempt
     * from the floor rule, so dropping it isn't an instant game over (C-2).
     */
    movingBlockId: string | null
    /** Block a pinch would grab right now (same id format as heldBlockId) */
    hoveredBlockId: string | null
    gameId: number
    isWebcamVisible: boolean
    isInstructionsVisible: boolean
    trackingStatus: TrackingStatus
    trackingError: string | null
    /** Which MediaPipe delegate is running; CPU means the GPU path failed */
    trackingDelegate: TrackingDelegate | null
    /** Bumped by retryTracking() to re-initialise the hand tracker */
    trackingAttempt: number
    setGameState: (state: GameState) => void
    startGame: (mode: GameMode) => void
    returnToMenu: () => void
    incrementScore: () => void
    setHeldBlockId: (id: string | null) => void
    setHoveredBlockId: (id: string | null) => void
    setWebcamVisible: (visible: boolean) => void
    setInstructionsVisible: (visible: boolean) => void
    resetGame: () => void
    setTrackingStatus: (status: TrackingStatus, error?: string | null) => void
    setTrackingDelegate: (delegate: TrackingDelegate | null) => void
    retryTracking: () => void
}

export const useGameStore = create<GameStore>((set) => ({
    gameMode: 'MENU',
    gameState: 'PLAYING',
    score: 0,
    heldBlockId: null,
    movingBlockId: null,
    hoveredBlockId: null,
    gameId: 0,
    isWebcamVisible: false,
    isInstructionsVisible: false,
    trackingStatus: 'loading',
    trackingError: null,
    trackingDelegate: null,
    trackingAttempt: 0,
    setGameState: (gameState) => set({ gameState }),
    startGame: (gameMode) => set({
        gameMode,
        gameState: 'PLAYING',
        score: 0,
        heldBlockId: null,
        movingBlockId: null,
        hoveredBlockId: null,
        isInstructionsVisible: true
    }),
    returnToMenu: () => set({ gameMode: 'MENU', gameState: 'PLAYING', heldBlockId: null, movingBlockId: null, hoveredBlockId: null }),
    incrementScore: () => set((state) => ({ score: state.score + 1 })),
    setHeldBlockId: (heldBlockId) => set((state) => ({
        heldBlockId,
        movingBlockId: heldBlockId ?? state.movingBlockId,
    })),
    setHoveredBlockId: (hoveredBlockId) => set({ hoveredBlockId }),
    setWebcamVisible: (isWebcamVisible) => set({ isWebcamVisible }),
    setInstructionsVisible: (isInstructionsVisible) => set({ isInstructionsVisible }),
    resetGame: () => set((state) => ({
        gameState: 'PLAYING',
        score: 0,
        heldBlockId: null,
        movingBlockId: null,
        hoveredBlockId: null,
        gameId: state.gameId + 1,
        isInstructionsVisible: state.gameMode === 'CLASSIC'
    })),
    setTrackingStatus: (trackingStatus, trackingError = null) => set({ trackingStatus, trackingError }),
    setTrackingDelegate: (trackingDelegate) => set({ trackingDelegate }),
    retryTracking: () => set((state) => ({
        trackingStatus: 'loading',
        trackingError: null,
        trackingAttempt: state.trackingAttempt + 1,
    })),
}))
