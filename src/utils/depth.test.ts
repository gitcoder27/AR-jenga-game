import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { calculateDepth, depthFromHandSize, handSize, handSizeForDepth, type DepthSettings } from './depth'
import { buildLandmarks } from '../test/handPoses'
import { landmarkToWorld } from '../tracking/mapping'
import { CAMERA_FOV, CAMERA_POSITION, CAMERA_TARGET } from '../game/config'

const ASPECT = 4 / 3

describe('calculateDepth', () => {
    it('returns larger Z for larger hand scale', () => {
        const makeLandmarks = (dist: number) => {
            const arr = Array(21).fill({ x: 0, y: 0, z: 0 })
            arr[0] = { x: 0, y: 0, z: 0 }
            arr[9] = { x: 0, y: dist, z: 0 }
            return arr
        }

        const z1 = calculateDepth(makeLandmarks(0.1))
        const z2 = calculateDepth(makeLandmarks(0.2))

        expect(z2).toBeGreaterThan(z1)
    })
})

describe('hand size is robust to hand pitch and roll (H-4)', () => {
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, ASPECT, 0.1, 1000)
    camera.position.set(...CAMERA_POSITION)
    camera.lookAt(new THREE.Vector3(...CAMERA_TARGET))
    camera.updateMatrixWorld()

    /** Foreshorten the hand about the wrist: y by `sy` (pitch), x by `sx` (roll) */
    const tilt = (sx: number, sy: number) => {
        const hand = buildLandmarks('relaxed', handSizeForDepth(0), 0.5, 0.5, ASPECT)
        const w = hand[0]
        return { hand, tilted: hand.map((l) => ({ x: w.x + (l.x - w.x) * sx, y: w.y + (l.y - w.y) * sy, z: l.z })) }
    }

    /** How far the depth change alone moves a point in front of the tower (world units) */
    const depthShift = (a: number, b: number) => {
        const p = { x: 0.5, y: 0.5, z: 0 }
        return landmarkToWorld(p, a, camera).distanceTo(landmarkToWorld(p, b, camera))
    }

    for (const [label, sx, sy] of [['pitched', 1, Math.cos(Math.PI / 6)], ['rolled', Math.cos(Math.PI / 6), 1]] as const) {
        it(`a hand ${label} 30° at a fixed distance moves less than 1 world unit in depth`, () => {
            const { hand, tilted } = tilt(sx, sy)
            const shift = depthShift(calculateDepth(hand, ASPECT), calculateDepth(tilted, ASPECT))
            // Palm length alone (before H-4) moves it by ~2.5
            const lengthOnly = (l: typeof hand) => Math.hypot((l[0].x - l[9].x) * ASPECT, l[0].y - l[9].y)
            const before = depthShift(depthFromHandSize(lengthOnly(hand)), depthFromHandSize(lengthOnly(tilted)))
            console.log(`H-4 ${label} 30°: depth moves ${shift.toFixed(2)} world units (palm length alone: ${before.toFixed(2)})`)
            expect(shift).toBeLessThan(1)
        })
    }

    it('measures in frame heights, whatever the video aspect', () => {
        const at = (aspect: number) => handSize(buildLandmarks('open', 0.2, 0.5, 0.5, aspect), aspect)
        expect(at(16 / 9)).toBeCloseTo(at(4 / 3), 6)
    })
})

describe('depth direction and calibration (H-3, H-4)', () => {
    const calibrated: DepthSettings = { calibration: { near: 0.3, far: 0.1 }, reachIn: false }

    it('mirror: a hand nearer the webcam is nearer the viewer (+1); reach-in flips it', () => {
        expect(depthFromHandSize(0.35)).toBe(1)
        expect(depthFromHandSize(0.35, { calibration: null, reachIn: true })).toBe(-1)
    })

    it('maps the calibrated near and far sizes to the ends of the range', () => {
        expect(depthFromHandSize(0.3, calibrated)).toBe(1)
        expect(depthFromHandSize(0.1, calibrated)).toBe(-1)
        expect(depthFromHandSize(0.2, calibrated)).toBeCloseTo(0, 6)
        // Beyond them it clamps
        expect(depthFromHandSize(0.5, calibrated)).toBe(1)
    })

    it('handSizeForDepth inverts depthFromHandSize for every setting', () => {
        for (const settings of [undefined, calibrated, { ...calibrated, reachIn: true }, { calibration: null, reachIn: true }]) {
            for (const d of [-1, -0.4, 0, 0.7, 1]) expect(depthFromHandSize(handSizeForDepth(d, settings), settings)).toBeCloseTo(d, 9)
        }
    })
})
