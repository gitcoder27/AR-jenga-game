import { useRef, useMemo } from 'react';
import {
  calculateGestureMetrics,
  transitionGestureState,
  calculateConfidence,
  calculatePinchPoint,
  type GestureState,
  type GestureMetrics,
} from '../utils/gestureState';
import { TRACKING_LOSS_GRACE_S } from '../game/config';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface GestureHookResult {
  // Boolean flags for common checks
  isPinching: boolean;
  isOpenPalm: boolean;
  // Legacy compatibility
  isClosedFist: boolean;  // Now maps to isOpenPalm for camera control
  // Enhanced state
  gestureState: GestureState;
  confidence: number;
  pinchPoint: Point3D | null;
  metrics: GestureMetrics | null;
}

/**
 * Enhanced gesture detection hook with:
 * - Hysteresis to prevent flickering
 * - Debouncing for stable activation
 * - Post-pinch cooldown to prevent false triggers
 * - Open palm detection for camera control
 */
export default function useGesture(landmarks: Point3D[] | undefined): GestureHookResult {
  // State refs for persistence across frames
  const gestureStateRef = useRef<GestureState>('IDLE');
  const readyTimestampRef = useRef<number | null>(null);
  const lastPinchEndTimeRef = useRef<number>(0);
  const wasPinchingRef = useRef<boolean>(false);
  const lostSinceRef = useRef<number | null>(null);

  const result = useMemo(() => {
    const now = performance.now();
    const metrics = calculateGestureMetrics(landmarks);

    if (!metrics) {
      // Keep the gesture state through brief dropouts (see below)
      lostSinceRef.current ??= now;
      return {
        isPinching: false,
        isOpenPalm: false,
        isClosedFist: false,
        gestureState: 'IDLE' as GestureState,
        confidence: 0,
        pinchPoint: null,
        metrics: null,
      };
    }

    // Tracking came back. After a dropout within the grace period, carry on
    // with the previous gesture, so a held pinch doesn't have to re-debounce
    // (and release the block meanwhile). After a longer loss, start over (H-5).
    if (lostSinceRef.current !== null && now - lostSinceRef.current > TRACKING_LOSS_GRACE_S * 1000) {
      gestureStateRef.current = 'IDLE';
      readyTimestampRef.current = null;
      wasPinchingRef.current = false;
    }
    lostSinceRef.current = null;

    // Track when pinch ends for cooldown
    const wasPinching = wasPinchingRef.current;

    // Run state machine transition
    const { newState, newReadyTimestamp } = transitionGestureState(
      gestureStateRef.current,
      metrics,
      readyTimestampRef.current,
      now,
      lastPinchEndTimeRef.current
    );

    // Track pinch end time for cooldown
    const isPinchingNow = newState === 'PINCHING';
    if (wasPinching && !isPinchingNow) {
      lastPinchEndTimeRef.current = now;
    }
    wasPinchingRef.current = isPinchingNow;

    // Update refs
    gestureStateRef.current = newState;
    readyTimestampRef.current = newReadyTimestamp;

    // Calculate confidence
    const confidence = calculateConfidence(newState, metrics);

    // Calculate pinch point for grab targeting
    const pinchPoint = calculatePinchPoint(landmarks);

    const isOpenPalm = newState === 'OPEN_PALM';

    return {
      isPinching: isPinchingNow,
      isOpenPalm,
      isClosedFist: isOpenPalm,  // Map to isClosedFist for existing camera control code
      gestureState: newState,
      confidence,
      pinchPoint,
      metrics,
    };
  }, [landmarks]);

  return result;
}