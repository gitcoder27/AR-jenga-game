import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FoulReason, MovePhase } from '../game/moves'
import { DEFAULT_DEPTH_SETTINGS, type DepthCalibration, type DepthSettings } from '../utils/depth'
import type { TutorialStep } from '../game/tutorial'

export type GameState = 'PLAYING' | 'GAME_OVER'
export type GameMode = 'MENU' | 'CLASSIC' | 'SANDBOX'
/**
 * Hand tracking lifecycle (H-9): model loading, failed, running with no hand
 * in view, or tracking a hand.
 */
export type TrackingStatus = 'loading' | 'error' | 'no-hand' | 'ready'
export type TrackingDelegate = 'GPU' | 'CPU'
/**
 * Depth calibration (H-4): in progress ('near', then 'far'), or how the last
 * attempt ended ('done', or failed: no hand seen, or near and far too alike).
 */
export type CalibrationStatus = 'idle' | 'near' | 'far' | 'done' | 'no-hand' | 'too-similar'
export type SceneBackground = 'studio' | 'camera'

export interface GameStore {
    gameMode: GameMode
    gameState: GameState
    score: number
    heldBlockId: string | null
    /** The block being moved this turn (Classic rules, C-1); null between moves */
    movingBlockId: string | null
    /** Where the current move is: see MoveTracker */
    movePhase: MovePhase
    /** Why the game ended, when it ended on a foul (C-4) */
    foulReason: FoulReason | null
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
    /**
     * Camera mode (H-2): the hand turns the view and touches nothing. Entered by
     * holding an open palm still (CameraClutch), the HUD button or the C key.
     */
    isCameraMode: boolean
    /** Depth direction and calibration (H-3, H-4); kept in this browser across visits */
    depthSettings: DepthSettings
    calibrationStatus: CalibrationStatus
    /** The guided first run (O-1): its current step, or null when it isn't running */
    tutorialStep: TutorialStep | null
    /** Finished or skipped once; kept in this browser, so it runs on the first Classic game only */
    tutorialDone: boolean
    /**
     * Behind the table: the virtual studio, or the mirrored webcam image ("mirror
     * AR", review feature #10). Kept in this browser across visits.
     */
    sceneBackground: SceneBackground
    setGameState: (state: GameState) => void
    startGame: (mode: GameMode) => void
    returnToMenu: () => void
    incrementScore: () => void
    setMovePhase: (phase: MovePhase, movingBlockId: string | null) => void
    /** A move completed: +1 and the next move starts */
    scoreMove: () => void
    foul: (reason: FoulReason) => void
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
    setCameraMode: (on: boolean) => void
    /** HUD button and C key; does nothing while a block is held */
    toggleCameraMode: () => void
    setReachIn: (reachIn: boolean) => void
    /** Begin the 5-second near/far calibration; does nothing while a block is held */
    startCalibration: () => void
    setCalibrationStatus: (status: CalibrationStatus) => void
    finishCalibration: (calibration: DepthCalibration) => void
    /** Back to the default range */
    clearCalibration: () => void
    /** A new Classic game with the tutorial from its first step */
    startTutorial: () => void
    setTutorialStep: (step: TutorialStep) => void
    /** Skip or close it; either way it is done */
    endTutorial: () => void
    setSceneBackground: (background: SceneBackground) => void
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
    movePhase: 'IDLE',
    foulReason: null,
    isCameraMode: false,
    calibrationStatus: 'idle',
} satisfies Partial<GameStore>

export const useGameStore = create<GameStore>()(persist((set) => ({
    gameMode: 'MENU',
    depthSettings: DEFAULT_DEPTH_SETTINGS,
    tutorialStep: null,
    tutorialDone: false,
    sceneBackground: 'studio',
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
    startGame: (gameMode) => set((state) => {
        // The first Classic game teaches (O-1), with the camera preview on for the camera check
        const tutorial = gameMode === 'CLASSIC' && !state.tutorialDone
        return {
            gameMode,
            ...FRESH_GAME,
            towerSeed: newTowerSeed(),
            isInstructionsVisible: !tutorial,
            tutorialStep: tutorial ? 'camera' : null,
            ...(tutorial ? { isWebcamVisible: true } : {}),
        }
    }),
    returnToMenu: () => set({ gameMode: 'MENU', ...FRESH_GAME, tutorialStep: null }),
    incrementScore: () => set((state) => ({ score: state.score + 1 })),
    setHeldBlockId: (heldBlockId) => set({ heldBlockId }),
    setMovePhase: (movePhase, movingBlockId) => set({ movePhase, movingBlockId }),
    scoreMove: () => set((state) => ({ score: state.score + 1, movePhase: 'IDLE', movingBlockId: null })),
    foul: (foulReason) => set({ gameState: 'GAME_OVER', foulReason }),
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
    setCameraMode: (isCameraMode) => set({ isCameraMode }),
    toggleCameraMode: () => set((state) => (state.heldBlockId !== null ? {} : { isCameraMode: !state.isCameraMode })),
    setReachIn: (reachIn) => set((state) => ({ depthSettings: { ...state.depthSettings, reachIn } })),
    startCalibration: () => set((state) => (state.heldBlockId !== null ? {} : { calibrationStatus: 'near', isCameraMode: false })),
    setCalibrationStatus: (calibrationStatus) => set({ calibrationStatus }),
    finishCalibration: (calibration) => set((state) => ({
        calibrationStatus: 'done',
        depthSettings: { ...state.depthSettings, calibration },
    })),
    clearCalibration: () => set((state) => ({ depthSettings: { ...state.depthSettings, calibration: null } })),
    startTutorial: () => set((state) => ({
        gameMode: 'CLASSIC',
        ...FRESH_GAME,
        gameId: state.gameId + 1,
        towerSeed: newTowerSeed(),
        isInstructionsVisible: false,
        isWebcamVisible: true,
        tutorialStep: 'camera',
    })),
    // Reaching the end counts as done, even if the last card is never closed
    setTutorialStep: (tutorialStep) => set(tutorialStep === 'done' ? { tutorialStep, tutorialDone: true } : { tutorialStep }),
    endTutorial: () => set({ tutorialStep: null, tutorialDone: true }),
    setSceneBackground: (sceneBackground) => set({ sceneBackground }),
}), {
    // Only the player's depth settings, background and whether they've had the tutorial outlive the page
    name: 'ar-jenga-settings',
    version: 1,
    partialize: (state) => ({ depthSettings: state.depthSettings, tutorialDone: state.tutorialDone, sceneBackground: state.sceneBackground }),
}))
