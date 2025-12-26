import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import useGesture from './useGesture'

/**
 * Hook-level tests for useGesture
 * 
 * Note: Detailed state machine logic (hysteresis, debounce, transitions)
 * is tested in src/utils/gestureState.test.ts. These tests verify the
 * hook's integration and basic functionality.
 */
describe('useGesture', () => {
  it('returns IDLE state when no landmarks are provided', () => {
    const { result } = renderHook(() => useGesture(undefined))
    expect(result.current.isPinching).toBe(false)
    expect(result.current.isClosedFist).toBe(false)
    expect(result.current.gestureState).toBe('IDLE')
    expect(result.current.confidence).toBe(0)
    expect(result.current.pinchPoint).toBe(null)
    expect(result.current.metrics).toBe(null)
  })

  it('returns metrics when landmarks provided', () => {
    const landmarks = Array(21).fill({ x: 0, y: 0, z: 0 });
    landmarks[4] = { x: 0, y: 0, z: 0 }; // thumb
    landmarks[8] = { x: 0.1, y: 0, z: 0 }; // index

    const { result } = renderHook(() => useGesture(landmarks))

    expect(result.current.metrics).not.toBe(null)
    expect(result.current.metrics?.pinchDistance).toBeCloseTo(0.1)
  })

  describe('Pinch Detection', () => {
    it('enters ready state when thumb and index are close', () => {
      const landmarks = Array(21).fill({ x: 0, y: 0, z: 0 });
      landmarks[4] = { x: 0, y: 0, z: 0 };
      landmarks[8] = { x: 0.05, y: 0, z: 0 }; // Below 0.06 enter threshold

      const { result } = renderHook(() => useGesture(landmarks))

      // Should at least be in PINCH_READY (debounce prevents immediate PINCHING)
      expect(['PINCH_READY', 'PINCHING'].includes(result.current.gestureState)).toBe(true)
    });

    it('stays IDLE when thumb and index are far apart', () => {
      const landmarks = Array(21).fill({ x: 0, y: 0, z: 0 });
      landmarks[4] = { x: 0, y: 0, z: 0 };
      landmarks[8] = { x: 0.2, y: 0, z: 0 }; // Well above threshold

      const { result } = renderHook(() => useGesture(landmarks))

      expect(result.current.gestureState).toBe('IDLE')
      expect(result.current.isPinching).toBe(false)
    });
  });

  describe('Fist Detection', () => {
    it('enters ready state when all fingers are curled', () => {
      const landmarks = Array(21).fill({ x: 0, y: 0, z: 0 });
      // All fingertips including thumb close to wrist
      [4, 8, 12, 16, 20].forEach(idx => {
        landmarks[idx] = { x: 0.15, y: 0, z: 0 }; // Below 0.22 threshold
      });

      const { result } = renderHook(() => useGesture(landmarks))

      // Should at least be in ready state
      expect(['FIST_READY', 'FIST'].includes(result.current.gestureState)).toBe(true)
    });

    it('stays IDLE when fingers are extended', () => {
      const landmarks = Array(21).fill({ x: 0, y: 0, z: 0 });
      // Fingers extended
      [8, 12, 16, 20].forEach(idx => {
        landmarks[idx] = { x: 0.4, y: 0, z: 0 }; // Well above threshold
      });

      const { result } = renderHook(() => useGesture(landmarks))

      expect(result.current.gestureState).toBe('IDLE')
      expect(result.current.isClosedFist).toBe(false)
    });
  });

  describe('Confidence Score', () => {
    it('returns confidence score for pinch-ready state', () => {
      const landmarks = Array(21).fill({ x: 0, y: 0, z: 0 });
      landmarks[4] = { x: 0, y: 0, z: 0 };
      landmarks[8] = { x: 0.02, y: 0, z: 0 }; // Very close

      const { result } = renderHook(() => useGesture(landmarks))

      expect(result.current.confidence).toBeGreaterThan(0.5)
    });
  });

  describe('Pinch Point Calculation', () => {
    it('calculates midpoint between thumb and index', () => {
      const landmarks = Array(21).fill({ x: 0, y: 0, z: 0 });
      landmarks[4] = { x: 0, y: 0, z: 0 };
      landmarks[8] = { x: 0.1, y: 0.2, z: 0.3 };

      const { result } = renderHook(() => useGesture(landmarks))

      expect(result.current.pinchPoint).toEqual({
        x: 0.05,
        y: 0.1,
        z: 0.15
      });
    });
  });

  describe('Mutual Exclusion', () => {
    it('pinch conditions detected over fist when both could apply', () => {
      const landmarks = Array(21).fill({ x: 0, y: 0, z: 0 });
      // Pinch: thumb and index close
      landmarks[4] = { x: 0, y: 0, z: 0 };
      landmarks[8] = { x: 0.05, y: 0, z: 0 };
      // Other fingers curled (fist-like)
      [12, 16, 20].forEach(idx => {
        landmarks[idx] = { x: 0.15, y: 0, z: 0 };
      });

      const { result } = renderHook(() => useGesture(landmarks))

      // Should detect pinch intent, not fist
      expect(['PINCH_READY', 'PINCHING'].includes(result.current.gestureState)).toBe(true)
      expect(result.current.gestureState).not.toBe('FIST_READY')
      expect(result.current.gestureState).not.toBe('FIST')
    });
  });
});
