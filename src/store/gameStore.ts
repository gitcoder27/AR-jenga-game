import { create } from 'zustand'

export type GameState = 'PLAYING' | 'GAME_OVER'
export type GameMode = 'MENU' | 'CLASSIC' | 'SANDBOX'
/**
 * Hand tracking lifecycle (H-9): model loading, failed, running with no hand
 * in view, or tracking a hand.
 */
export type TrackingStatus = 'loading' | 'error' | 'no-hand' | 'ready'
export type TrackingDelegate = 'GPU' | 'CPU'

export interface GameStore {
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
    /** Slot ("level-slot") the held block would snap into if let go now (C-3) */
    placementTarget: string | null
    gameId: number
    /** Seeds the tower's layout jitter and block shades; new for every game */
    towerSeed: number
    isWebcamVisible: boolean
    isInstructionsVisible: boolean
    trackingStatus: TrackingStatus
    trackingError: string | null
    /** Which MediaPipe delegate is running; CPU means the GPU path failed */
    trackingDelegate: TrackingDelegate | null
    /** Bumped by retryTracking() to re-initialise the hand tracker */
    trackingAttempt: number
    /** Bumped by resetView() to put the camera back at its default framing */
    viewResetId: number
    setGameState: (state: GameState) => void
    startGame: (mode: GameMode) => void
    returnToMenu: () => void
    incrementScore: () => void
    setHeldBlockId: (id: string | null) => void
    setHoveredBlockId: (id: string | null) => void
    setPlacementTarget: (target: string | null) => void
    setWebcamVisible: (visible: boolean) => void
    setInstructionsVisible: (visible: boolean) => void
    resetGame: () => void
    setTrackingStatus: (status: TrackingStatus, error?: string | null) => void
    setTrackingDelegate: (delegate: TrackingDelegate | null) => void
    retryTracking: () => void
    resetView: () => void
}

const newTowerSeed = () => Math.floor(Math.random() * 2 ** 31)

/** Per-game state, cleared on start, reset and exit. */
const FRESH_GAME = {
    gameState: 'PLAYING',
    score: 0,
    heldBlockId: null,
    movingBlockId: null,
    hoveredBlockId: null,
    placementTarget: null,
} satisfies Partial<GameStore>

export const useGameStore = create<GameStore>((set) => ({
    gameMode: 'MENU',
    ...FRESH_GAME,
    gameId: 0,
    towerSeed: 1,
    isWebcamVisible: false,
    isInstructionsVisible: false,
    trackingStatus: 'loading',
    trackingError: null,
    trackingDelegate: null,
    trackingAttempt: 0,
    viewResetId: 0,
    setGameState: (gameState) => set({ gameState }),
    startGame: (gameMode) => set({
        gameMode,
        ...FRESH_GAME,
        towerSeed: newTowerSeed(),
        isInstructionsVisible: true
    }),
    returnToMenu: () => set({ gameMode: 'MENU', ...FRESH_GAME }),
    incrementScore: () => set((state) => ({ score: state.score + 1 })),
    setHeldBlockId: (heldBlockId) => set((state) => ({
        heldBlockId,
        movingBlockId: heldBlockId ?? state.movingBlockId,
    })),
    setHoveredBlockId: (hoveredBlockId) => set({ hoveredBlockId }),
    setPlacementTarget: (placementTarget) => set({ placementTarget }),
    setWebcamVisible: (isWebcamVisible) => set({ isWebcamVisible }),
    setInstructionsVisible: (isInstructionsVisible) => set({ isInstructionsVisible }),
    resetGame: () => set((state) => ({
        ...FRESH_GAME,
        gameId: state.gameId + 1,
        towerSeed: newTowerSeed(),
        isInstructionsVisible: state.gameMode === 'CLASSIC'
    })),
    setTrackingStatus: (trackingStatus, trackingError = null) => set({ trackingStatus, trackingError }),
    setTrackingDelegate: (trackingDelegate) => set({ trackingDelegate }),
    retryTracking: () => set((state) => ({
        trackingStatus: 'loading',
        trackingError: null,
        trackingAttempt: state.trackingAttempt + 1,
    })),
    resetView: () => set((state) => ({ viewResetId: state.viewResetId + 1 })),
}))
