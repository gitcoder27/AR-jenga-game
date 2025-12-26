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

  it('detects closed fist when all fingertips are close to palm', () => {
    const landmarks = Array(21).fill({ x: 0, y: 0, z: 0 });
    // Wrist at (0,0,0)
    // Fingertips 8, 12, 16, 20 all at distance 0.1
    [8, 12, 16, 20].forEach(idx => {
      landmarks[idx] = { x: 0.1, y: 0, z: 0 };
    });

    const { result } = renderHook(() => useGesture(landmarks))
    expect(result.current.isClosedFist).toBe(true)
  })

  it('does not detect closed fist when fingers are extended', () => {
    const landmarks = Array(21).fill({ x: 0, y: 0, z: 0 });
    // Wrist at (0,0,0)
    // One finger extended (distance 0.3 > threshold 0.25)
    [8, 12, 16, 20].forEach(idx => {
      landmarks[idx] = { x: 0.1, y: 0, z: 0 };
    });
    landmarks[8] = { x: 0.3, y: 0, z: 0 };

    const { result } = renderHook(() => useGesture(landmarks))
    expect(result.current.isClosedFist).toBe(false)
  })
});
