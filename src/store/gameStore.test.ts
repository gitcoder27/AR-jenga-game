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
    expect(state.score).toBe(0)
    expect(state.heldBlockId).toBeNull()
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
})
