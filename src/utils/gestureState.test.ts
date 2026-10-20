import { describe, it, expect } from 'vitest'
import {
    calculateGestureMetrics,
    transitionGestureState,
    calculateConfidence,
    PINCH_ENTER_THRESHOLD,
    PINCH_EXIT_THRESHOLD,
    GESTURE_DEBOUNCE_MS,
    PALM_FINGER_SPREAD,
    type GestureMetrics,
    type GestureState,
} from './gestureState'
import { buildLandmarks, type PoseName } from '../test/handPoses'

describe('gestureState', () => {
    describe('calculateGestureMetrics', () => {
        it('returns null for undefined landmarks', () => {
            expect(calculateGestureMetrics(undefined)).toBeNull()
        })

        it('returns null for insufficient landmarks', () => {
            const landmarks = Array(10).fill({ x: 0, y: 0, z: 0 })
            expect(calculateGestureMetrics(landmarks)).toBeNull()
        })

        it('measures the pinch gap in palm lengths', () => {
            const landmarks = buildLandmarks('pinch', 0.2, 0.5, 0.5)
            const metrics = calculateGestureMetrics(landmarks)!
            expect(metrics.palmSize).toBeCloseTo(0.2)
            expect(metrics.pinchRatio).toBeCloseTo(0.07, 2)
        })

        it('corrects for the video aspect ratio', () => {
            // Same physical pose seen by a 16:9 camera: x is squeezed by the aspect
            const square = calculateGestureMetrics(buildLandmarks('open', 0.2, 0.5, 0.5, 1), 1)!
            const wide = calculateGestureMetrics(buildLandmarks('open', 0.2, 0.5, 0.5, 16 / 9), 16 / 9)!
            expect(wide.pinchRatio).toBeCloseTo(square.pinchRatio)
            expect(wide.fingerSpread).toBeCloseTo(square.fingerSpread)
        })

        it('reads finger extension from joint angles', () => {
            expect(calculateGestureMetrics(buildLandmarks('open', 0.2, 0.5, 0.5))!.allFingersExtended).toBe(true)
            expect(calculateGestureMetrics(buildLandmarks('claw', 0.2, 0.5, 0.5))!.allFingersExtended).toBe(false)
            expect(calculateGestureMetrics(buildLandmarks('fist', 0.2, 0.5, 0.5))!.indexFolded).toBe(true)
            expect(calculateGestureMetrics(buildLandmarks('pinch', 0.2, 0.5, 0.5))!.indexFolded).toBe(false)
        })
    })

    describe('transitionGestureState', () => {
        const baseMetrics: GestureMetrics = {
            palmSize: 0.2,
            pinchRatio: 1,
            fingerSpread: 0.3,
            allFingersExtended: false,
            thumbExtended: false,
            indexFolded: false,
        }

        it('transitions IDLE -> PINCH_READY when pinch condition met', () => {
            const metrics = { ...baseMetrics, pinchRatio: PINCH_ENTER_THRESHOLD - 0.01 }
            const result = transitionGestureState('IDLE', metrics, null, 0, 0)

            expect(result.newState).toBe('PINCH_READY')
            expect(result.newReadyTimestamp).toBe(0)
        })

        it('transitions PINCH_READY -> PINCHING after debounce', () => {
            const metrics = { ...baseMetrics, pinchRatio: PINCH_ENTER_THRESHOLD - 0.01 }
            const readyTime = 100
            const now = readyTime + GESTURE_DEBOUNCE_MS + 10

            const result = transitionGestureState('PINCH_READY', metrics, readyTime, now, 0)

            expect(result.newState).toBe('PINCHING')
        })

        it('stays in PINCHING until exit threshold crossed', () => {
            const metrics = { ...baseMetrics, pinchRatio: (PINCH_ENTER_THRESHOLD + PINCH_EXIT_THRESHOLD) / 2 }

            const result = transitionGestureState('PINCHING', metrics, null, 100, 0)

            expect(result.newState).toBe('PINCHING')
        })

        it('does not start a pinch with a folded index finger (fist)', () => {
            const metrics = { ...baseMetrics, pinchRatio: 0.05, indexFolded: true }
            expect(transitionGestureState('IDLE', metrics, null, 0, 0).newState).toBe('IDLE')
        })

        it('transitions PINCHING -> IDLE when exit threshold crossed', () => {
            const metrics = { ...baseMetrics, pinchRatio: PINCH_EXIT_THRESHOLD + 0.01 }

            const result = transitionGestureState('PINCHING', metrics, null, 100, 0)

            expect(result.newState).toBe('IDLE')
        })

        it('transitions IDLE -> PALM_READY when open palm detected', () => {
            const palmMetrics = {
                ...baseMetrics,
                fingerSpread: PALM_FINGER_SPREAD + 0.05,
                allFingersExtended: true,
                thumbExtended: true,
            }

            const result = transitionGestureState('IDLE', palmMetrics, null, 500, 0)

            expect(result.newState).toBe('PALM_READY')
        })

        it('respects post-pinch cooldown for palm detection', () => {
            const palmMetrics = {
                ...baseMetrics,
                fingerSpread: PALM_FINGER_SPREAD + 0.05,
                allFingersExtended: true,
                thumbExtended: true,
            }

            // Last pinch ended at 400ms, now is 500ms, cooldown is 200ms
            const result = transitionGestureState('IDLE', palmMetrics, null, 500, 400)

            expect(result.newState).toBe('IDLE') // Should stay idle due to cooldown
        })
    })

    describe('calculateConfidence', () => {
        const metrics: GestureMetrics = {
            palmSize: 0.2,
            pinchRatio: 1,
            fingerSpread: 0.3,
            allFingersExtended: false,
            thumbExtended: false,
            indexFolded: false,
        }

        it('returns 0 for IDLE state', () => {
            expect(calculateConfidence('IDLE', metrics)).toBe(0)
        })

        it('returns higher confidence for tighter pinch', () => {
            expect(calculateConfidence('PINCHING', { ...metrics, pinchRatio: 0.05 })).toBeGreaterThan(
                calculateConfidence('PINCHING', { ...metrics, pinchRatio: 0.3 })
            )
        })
    })

    // H-1: the same pose must classify the same at every hand distance (palm
    // size s, which is also what depth is read from) and in any camera aspect.
    describe('scale and aspect invariance [H-1]', () => {
        const EXPECTED: Record<PoseName, GestureState> = {
            open: 'OPEN_PALM',
            relaxed: 'IDLE',
            claw: 'IDLE',
            fist: 'IDLE',
            pinch: 'PINCHING',
            tuckedReady: 'IDLE',
            tuckedPinch: 'PINCHING',
        }
        const SIZES = [0.06, 0.08, 0.1, 0.15, 0.2, 0.245, 0.3, 0.35, 0.4]
        const ASPECTS = [4 / 3, 16 / 9, 1]

        /** Settle the state machine on a held pose for 0.5 s at 30 FPS, from IDLE. */
        function classify(pose: PoseName, size: number, aspect: number): GestureState {
            const metrics = calculateGestureMetrics(buildLandmarks(pose, size, 0.5, 0.5, aspect), aspect)!
            let state: GestureState = 'IDLE'
            let ready: number | null = null
            for (let t = 1000; t <= 1500; t += 33) {
                ;({ newState: state, newReadyTimestamp: ready } = transitionGestureState(state, metrics, ready, t, 0))
            }
            return state
        }

        for (const pose of Object.keys(EXPECTED) as PoseName[]) {
            it(`${pose} reads as ${EXPECTED[pose]} for s in [0.06, 0.40] and aspect 4:3, 16:9, 1:1`, () => {
                for (const aspect of ASPECTS) {
                    for (const size of SIZES) {
                        expect({ size, aspect, state: classify(pose, size, aspect) }).toEqual({ size, aspect, state: EXPECTED[pose] })
                    }
                }
            })
        }

        it('a relaxed hand releases a pinch at every distance', () => {
            for (const size of SIZES) {
                const metrics = calculateGestureMetrics(buildLandmarks('relaxed', size, 0.5, 0.5, 16 / 9), 16 / 9)!
                expect(transitionGestureState('PINCHING', metrics, null, 0, 0).newState).toBe('IDLE')
            }
        })
    })
})
