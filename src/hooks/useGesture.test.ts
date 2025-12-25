import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import useGesture from './useGesture'

describe('useGesture', () => {
  it('returns false when no landmarks are provided', () => {
    const { result } = renderHook(() => useGesture(undefined))
    expect(result.current.isPinching).toBe(false)
  })

  it('detects pinch when thumb and index are close', () => {
    // Mock landmarks where tip 4 and 8 are close (distance < 0.05)
    const landmarks = Array(21).fill({ x: 0, y: 0, z: 0 });
    landmarks[4] = { x: 0, y: 0, z: 0 };
    landmarks[8] = { x: 0.04, y: 0, z: 0 }; // Distance 0.04

    const { result } = renderHook(() => useGesture(landmarks))
    expect(result.current.isPinching).toBe(true)
  })

  it('does not detect pinch when thumb and index are far', () => {
    // Mock landmarks where tip 4 and 8 are far (distance > 0.05)
    const landmarks = Array(21).fill({ x: 0, y: 0, z: 0 });
    landmarks[4] = { x: 0, y: 0, z: 0 };
    landmarks[8] = { x: 0.1, y: 0, z: 0 }; // Distance 0.1

    const { result } = renderHook(() => useGesture(landmarks))
    expect(result.current.isPinching).toBe(false)
  })
})
