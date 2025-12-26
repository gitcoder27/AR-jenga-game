import { describe, it, expect } from 'vitest'
import {
    calculateGestureMetrics,
    transitionGestureState,
    calculateConfidence,
    calculatePinchPoint,
    PINCH_ENTER_THRESHOLD,
    PINCH_EXIT_THRESHOLD,
    GESTURE_DEBOUNCE_MS,
} from './gestureState'

describe('gestureState', () => {
    describe('calculateGestureMetrics', () => {
        it('returns null for undefined landmarks', () => {
            expect(calculateGestureMetrics(undefined)).toBeNull()
        })

        it('returns null for insufficient landmarks', () => {
            const landmarks = Array(10).fill({ x: 0, y: 0, z: 0 })
            expect(calculateGestureMetrics(landmarks)).toBeNull()
        })

        it('calculates correct pinch distance', () => {
            const landmarks = Array(21).fill({ x: 0, y: 0, z: 0 })
            landmarks[4] = { x: 0, y: 0, z: 0 } // thumb
            landmarks[8] = { x: 0.1, y: 0, z: 0 } // index

            const metrics = calculateGestureMetrics(landmarks)
            expect(metrics?.pinchDistance).toBeCloseTo(0.1)
        })

        it('calculates finger extension from wrist distance', () => {
            const landmarks = Array(21).fill({ x: 0, y: 0, z: 0 })
            landmarks[0] = { x: 0, y: 0, z: 0 } // Wrist
                ;[8, 12, 16, 20].forEach(idx => {
                    landmarks[idx] = { x: 0.3, y: 0, z: 0 }
                })

            const metrics = calculateGestureMetrics(landmarks)
            expect(metrics?.avgFingerExtension).toBeCloseTo(0.3)
        })

        it('detects all fingers extended', () => {
            const landmarks = Array(21).fill({ x: 0, y: 0, z: 0 })
            landmarks[0] = { x: 0, y: 0, z: 0 } // Wrist
                ;[8, 12, 16, 20].forEach(idx => {
                    landmarks[idx] = { x: 0.35, y: 0, z: 0 } // > PALM_FINGER_MIN_DIST
                })

            const metrics = calculateGestureMetrics(landmarks)
            expect(metrics?.allFingersExtended).toBe(true)
        })
    })

    describe('transitionGestureState', () => {
        const baseMetrics = {
            pinchDistance: 0.5,
            avgFingerExtension: 0.2,
            fingerSpread: 0.05,
            allFingersExtended: false,
            thumbExtended: false,
        }

        it('transitions IDLE -> PINCH_READY when pinch condition met', () => {
            const metrics = { ...baseMetrics, pinchDistance: PINCH_ENTER_THRESHOLD - 0.01 }
            const result = transitionGestureState('IDLE', metrics, null, 0, 0)

            expect(result.newState).toBe('PINCH_READY')
            expect(result.newReadyTimestamp).toBe(0)
        })

        it('transitions PINCH_READY -> PINCHING after debounce', () => {
            const metrics = { ...baseMetrics, pinchDistance: PINCH_ENTER_THRESHOLD - 0.01 }
            const readyTime = 100
            const now = readyTime + GESTURE_DEBOUNCE_MS + 10

            const result = transitionGestureState('PINCH_READY', metrics, readyTime, now, 0)

            expect(result.newState).toBe('PINCHING')
        })

        it('stays in PINCHING until exit threshold crossed', () => {
            const metrics = { ...baseMetrics, pinchDistance: (PINCH_ENTER_THRESHOLD + PINCH_EXIT_THRESHOLD) / 2 }

            const result = transitionGestureState('PINCHING', metrics, null, 100, 0)

            expect(result.newState).toBe('PINCHING')
        })

        it('transitions PINCHING -> IDLE when exit threshold crossed', () => {
            const metrics = { ...baseMetrics, pinchDistance: PINCH_EXIT_THRESHOLD + 0.01 }

            const result = transitionGestureState('PINCHING', metrics, null, 100, 0)

            expect(result.newState).toBe('IDLE')
        })

        it('transitions IDLE -> PALM_READY when open palm detected', () => {
            const palmMetrics = {
                ...baseMetrics,
                pinchDistance: 0.5,
                avgFingerExtension: 0.35,
                fingerSpread: 0.12,
                allFingersExtended: true,
                thumbExtended: true,
            }

            const result = transitionGestureState('IDLE', palmMetrics, null, 500, 0)

            expect(result.newState).toBe('PALM_READY')
        })

        it('respects post-pinch cooldown for palm detection', () => {
            const palmMetrics = {
                ...baseMetrics,
                pinchDistance: 0.5,
                avgFingerExtension: 0.35,
                fingerSpread: 0.12,
                allFingersExtended: true,
                thumbExtended: true,
            }

            // Last pinch ended at 400ms, now is 500ms, cooldown is 200ms
            const result = transitionGestureState('IDLE', palmMetrics, null, 500, 400)

            expect(result.newState).toBe('IDLE') // Should stay idle due to cooldown
        })
    })

    describe('calculateConfidence', () => {
        it('returns 0 for IDLE state', () => {
            const metrics = {
                pinchDistance: 0.5,
                avgFingerExtension: 0.2,
                fingerSpread: 0.05,
                allFingersExtended: false,
                thumbExtended: false,
            }
            expect(calculateConfidence('IDLE', metrics)).toBe(0)
        })

        it('returns higher confidence for tighter pinch', () => {
            const looseMetrics = {
                pinchDistance: 0.08,
                avgFingerExtension: 0.2,
                fingerSpread: 0.05,
                allFingersExtended: false,
                thumbExtended: false,
            }
            const tightMetrics = {
                pinchDistance: 0.02,
                avgFingerExtension: 0.2,
                fingerSpread: 0.05,
                allFingersExtended: false,
                thumbExtended: false,
            }

            expect(calculateConfidence('PINCHING', tightMetrics)).toBeGreaterThan(
                calculateConfidence('PINCHING', looseMetrics)
            )
        })
    })

    describe('calculatePinchPoint', () => {
        it('returns null for undefined landmarks', () => {
            expect(calculatePinchPoint(undefined)).toBeNull()
        })

        it('calculates midpoint between thumb and index tips', () => {
            const landmarks = Array(21).fill({ x: 0, y: 0, z: 0 })
            landmarks[4] = { x: 0, y: 0, z: 0 }
            landmarks[8] = { x: 1, y: 2, z: 3 }

            const point = calculatePinchPoint(landmarks)

            expect(point).toEqual({ x: 0.5, y: 1, z: 1.5 })
        })
    })
})
