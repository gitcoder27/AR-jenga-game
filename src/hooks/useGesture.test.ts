import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import useGesture from './useGesture'
import { buildLandmarks } from '../test/handPoses'

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
    expect(result.current.isOpenPalm).toBe(false)
    expect(result.current.gestureState).toBe('IDLE')
    expect(result.current.confidence).toBe(0)
    expect(result.current.pinchPoint).toBe(null)
    expect(result.current.metrics).toBe(null)
  })

  it('returns metrics when landmarks provided', () => {
    const { result } = renderHook(() => useGesture(buildLandmarks('pinch', 0.2, 0.5, 0.5)))

    expect(result.current.metrics).not.toBe(null)
    expect(result.current.metrics?.palmSize).toBeCloseTo(0.2)
  })

  it('returns no metrics for a degenerate hand with no palm', () => {
    const { result } = renderHook(() => useGesture(Array(21).fill({ x: 0, y: 0, z: 0 })))
    expect(result.current.metrics).toBe(null)
    expect(result.current.gestureState).toBe('IDLE')
  })

  describe('Pinch Detection', () => {
    it('enters ready state when thumb and index are close', () => {
      const { result } = renderHook(() => useGesture(buildLandmarks('pinch', 0.2, 0.5, 0.5)))

      // Should at least be in PINCH_READY (debounce prevents immediate PINCHING)
      expect(['PINCH_READY', 'PINCHING'].includes(result.current.gestureState)).toBe(true)
    });

    it('stays IDLE when thumb and index are far apart', () => {
      const { result } = renderHook(() => useGesture(buildLandmarks('relaxed', 0.2, 0.5, 0.5)))

      expect(result.current.gestureState).toBe('IDLE')
      expect(result.current.isPinching).toBe(false)
    });
  });

  describe('Fist Detection', () => {
    it('a fist is not a pinch (H-1)', () => {
      // The thumb rests on the folded index finger, so the tips are close
      const { result } = renderHook(() => useGesture(buildLandmarks('fist', 0.2, 0.5, 0.5)))

      expect(result.current.gestureState).toBe('IDLE')
      expect(result.current.isPinching).toBe(false)
    });

    it('a relaxed open hand is not an open palm', () => {
      const { result } = renderHook(() => useGesture(buildLandmarks('relaxed', 0.35, 0.5, 0.5)))

      expect(result.current.gestureState).toBe('IDLE')
      expect(result.current.isOpenPalm).toBe(false)
    });
  });

  describe('Confidence Score', () => {
    it('returns confidence score for pinch-ready state', () => {
      const { result } = renderHook(() => useGesture(buildLandmarks('pinch', 0.2, 0.5, 0.5)))

      expect(result.current.confidence).toBeGreaterThan(0.5)
    });
  });

  describe('Pinch Point Calculation', () => {
    it('calculates midpoint between thumb and index', () => {
      const landmarks = buildLandmarks('pinch', 0.2, 0.5, 0.5)
      landmarks[4] = { x: 0.4, y: 0.4, z: 0 };
      landmarks[8] = { x: 0.5, y: 0.6, z: 0.3 };

      const { result } = renderHook(() => useGesture(landmarks))

      expect(result.current.pinchPoint!.x).toBeCloseTo(0.45)
      expect(result.current.pinchPoint!.y).toBeCloseTo(0.5)
      expect(result.current.pinchPoint!.z).toBeCloseTo(0.15)
    });
  });

  describe('Mutual Exclusion', () => {
    it('a pinch with the other fingers tucked is still a pinch', () => {
      const { result } = renderHook(() => useGesture(buildLandmarks('tuckedPinch', 0.2, 0.5, 0.5)))

      expect(['PINCH_READY', 'PINCHING'].includes(result.current.gestureState)).toBe(true)
    });
  });

  describe('tracking dropouts (H-5)', () => {
    afterEach(() => vi.restoreAllMocks())

    // Fresh arrays every frame, like the real detector
    const pinchFrame = () => buildLandmarks('pinch', 0.2, 0.5, 0.5)

    function pinchThenDrop(dropMs: number) {
      let now = 1000
      vi.spyOn(performance, 'now').mockImplementation(() => now)
      const { result, rerender } = renderHook(({ lm }) => useGesture(lm), { initialProps: { lm: pinchFrame() as { x: number; y: number; z: number }[] | undefined } })
      for (let i = 0; i < 10; i++) { now += 50; rerender({ lm: pinchFrame() }) }
      expect(result.current.isPinching).toBe(true)
      now += 16; rerender({ lm: undefined })
      now += dropMs; rerender({ lm: pinchFrame() })
      return result.current
    }

    it('keeps pinching after a dropout shorter than the grace period', () => {
      expect(pinchThenDrop(150).isPinching).toBe(true)
    })

    it('starts over after a dropout longer than the grace period', () => {
      expect(pinchThenDrop(1000).isPinching).toBe(false)
    })
  })
})
