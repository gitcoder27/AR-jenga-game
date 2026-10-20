import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useGameStore } from './gameStore'

describe('useGameStore', () => {
  beforeEach(() => {
    act(() => {
      useGameStore.getState().resetGame()
    })
  })

  it('initializes with default values', () => {
    const state = useGameStore.getState()
    expect(state.gameState).toBe('PLAYING')
    expect(state.gameMode).toBe('MENU')
    expect(state.score).toBe(0)
    expect(state.heldBlockId).toBeNull()
  })

  it('starts game in classic mode', () => {
    act(() => {
      // A returning player: the first Classic game would run the tutorial instead (O-1)
      useGameStore.setState({ tutorialDone: true })
      useGameStore.getState().startGame('CLASSIC')
    })
    const state = useGameStore.getState()
    expect(state.gameMode).toBe('CLASSIC')
    expect(state.isInstructionsVisible).toBe(true)
  })

  it('starts game in sandbox mode', () => {
    act(() => {
      useGameStore.getState().startGame('SANDBOX')
    })
    const state = useGameStore.getState()
    expect(state.gameMode).toBe('SANDBOX')
    expect(state.isInstructionsVisible).toBe(true)
  })

  it('returns to menu', () => {
    act(() => {
      useGameStore.getState().startGame('CLASSIC')
      useGameStore.getState().returnToMenu()
    })
    expect(useGameStore.getState().gameMode).toBe('MENU')
  })

  it('updates game state', () => {
    act(() => {
      useGameStore.getState().setGameState('GAME_OVER')
    })
    expect(useGameStore.getState().gameState).toBe('GAME_OVER')
  })

  it('increments score', () => {
    act(() => {
      useGameStore.getState().incrementScore()
    })
    expect(useGameStore.getState().score).toBe(1)
  })

  it('sets held block', () => {
    act(() => {
      useGameStore.getState().setHeldBlockId('block-1')
    })
    expect(useGameStore.getState().heldBlockId).toBe('block-1')
  })

  it('resets game', () => {
    act(() => {
      useGameStore.getState().setGameState('GAME_OVER')
      useGameStore.getState().incrementScore()
      useGameStore.getState().resetGame()
    })
    const state = useGameStore.getState()
    expect(state.gameState).toBe('PLAYING')
    expect(state.score).toBe(0)
    expect(state.heldBlockId).toBeNull()
  })

  it('tracks the move, scores it, and clears it on reset (C-1)', () => {
    const { setHeldBlockId, setMovePhase, scoreMove } = useGameStore.getState()
    act(() => {
      setHeldBlockId('2-0')
      setMovePhase('HOLDING', '2-0')
    })
    expect(useGameStore.getState()).toMatchObject({ heldBlockId: '2-0', movingBlockId: '2-0', movePhase: 'HOLDING' })
    act(() => scoreMove())
    expect(useGameStore.getState()).toMatchObject({ score: 1, movingBlockId: null, movePhase: 'IDLE' })
    act(() => useGameStore.getState().resetGame())
    expect(useGameStore.getState()).toMatchObject({ score: 0, heldBlockId: null, movingBlockId: null, movePhase: 'IDLE' })
  })

  it('a foul ends the game with its reason (C-4)', () => {
    act(() => useGameStore.getState().foul('dropped'))
    expect(useGameStore.getState()).toMatchObject({ gameState: 'GAME_OVER', foulReason: 'dropped' })
    act(() => useGameStore.getState().resetGame())
    expect(useGameStore.getState()).toMatchObject({ gameState: 'PLAYING', foulReason: null })
  })

  it('camera mode toggles, never while a block is held, and a reset turns it off (H-2)', () => {
    const { toggleCameraMode, setHeldBlockId } = useGameStore.getState()
    act(() => toggleCameraMode())
    expect(useGameStore.getState().isCameraMode).toBe(true)
    act(() => useGameStore.getState().resetGame())
    expect(useGameStore.getState().isCameraMode).toBe(false)
    act(() => {
      setHeldBlockId('2-0')
      toggleCameraMode()
    })
    expect(useGameStore.getState().isCameraMode).toBe(false)
  })

  it('depth settings: direction and calibration are kept across visits, with only the tutorial flag and background (H-3, H-4)', () => {
    const s = useGameStore.getState()
    act(() => {
      s.setHeldBlockId(null)
      s.setReachIn(true)
      s.startCalibration()
    })
    expect(useGameStore.getState().calibrationStatus).toBe('near')
    act(() => useGameStore.getState().finishCalibration({ near: 0.3, far: 0.1 }))
    expect(useGameStore.getState()).toMatchObject({
      calibrationStatus: 'done',
      depthSettings: { reachIn: true, calibration: { near: 0.3, far: 0.1 } },
    })
    const saved = JSON.parse(localStorage.getItem('ar-jenga-settings')!)
    expect(Object.keys(saved.state)).toEqual(['depthSettings', 'tutorialDone', 'sceneBackground'])
    act(() => {
      useGameStore.getState().clearCalibration()
      useGameStore.getState().setReachIn(false)
    })
    expect(useGameStore.getState().depthSettings).toEqual({ calibration: null, reachIn: false })
  })

  it('the first Classic game runs the tutorial with the preview on; once done, it never starts again (O-1)', () => {
    act(() => useGameStore.setState({ tutorialDone: false, isWebcamVisible: false }))
    act(() => useGameStore.getState().startGame('SANDBOX'))
    expect(useGameStore.getState().tutorialStep).toBeNull()
    act(() => useGameStore.getState().startGame('CLASSIC'))
    expect(useGameStore.getState()).toMatchObject({ tutorialStep: 'camera', isWebcamVisible: true, isInstructionsVisible: false })
    // A foul's restart keeps it going
    act(() => useGameStore.getState().resetGame())
    expect(useGameStore.getState().tutorialStep).toBe('camera')
    act(() => useGameStore.getState().setTutorialStep('done'))
    expect(useGameStore.getState().tutorialDone).toBe(true)
    act(() => useGameStore.getState().endTutorial())
    act(() => useGameStore.getState().startGame('CLASSIC'))
    expect(useGameStore.getState().tutorialStep).toBeNull()
    // Replayable from SETTINGS
    act(() => useGameStore.getState().startTutorial())
    expect(useGameStore.getState()).toMatchObject({ gameMode: 'CLASSIC', tutorialStep: 'camera' })
    act(() => useGameStore.getState().returnToMenu())
    expect(useGameStore.getState().tutorialStep).toBeNull()
  })

  it('the background defaults to the studio; the mirror-AR choice outlives games and visits (feature #10)', () => {
    act(() => useGameStore.setState({ sceneBackground: 'studio' }))
    act(() => useGameStore.getState().setSceneBackground('camera'))
    act(() => useGameStore.getState().startGame('SANDBOX'))
    act(() => useGameStore.getState().resetGame())
    act(() => useGameStore.getState().returnToMenu())
    expect(useGameStore.getState().sceneBackground).toBe('camera')
    expect(JSON.parse(localStorage.getItem('ar-jenga-settings')!).state.sceneBackground).toBe('camera')
    act(() => useGameStore.getState().setSceneBackground('studio'))
  })
})
