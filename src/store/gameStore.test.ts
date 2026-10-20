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
})
