import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { HAND_SCALE, frameTextureTransform, handToWorld, landmarkToWorld, pinchAnchor, worldToLandmark } from './mapping'
import {
    BLOCK_HEIGHT,
    BLOCK_LENGTH,
    CAMERA_FOV,
    CAMERA_MAX_DISTANCE,
    CAMERA_MAX_POLAR_ANGLE,
    CAMERA_MIN_DISTANCE,
    CAMERA_MIN_POLAR_ANGLE,
    CAMERA_POSITION,
    CAMERA_TARGET,
    TOWER_LEVELS,
} from '../game/config'

const ASPECTS = { desktop: 1280 / 720, portrait: 390 / 844, landscape: 844 / 390, '4:3': 4 / 3 }
const target = new THREE.Vector3(...CAMERA_TARGET)

function cameraAt(aspect: number, position: THREE.Vector3): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 1000)
    camera.position.copy(position)
    camera.lookAt(target)
    camera.updateMatrixWorld()
    return camera
}

function orbitCamera(aspect: number, polar: number, distance: number, azimuth = 0) {
    const offset = new THREE.Vector3().setFromSphericalCoords(distance, polar, azimuth)
    return cameraAt(aspect, target.clone().add(offset))
}

/** Where a block goes on top of the tower: the centre of the next level */
const TOP_PLACEMENT = new THREE.Vector3(0, (TOWER_LEVELS + 0.5) * BLOCK_HEIGHT, 0)
/** Pinch points in front of the bottom and top levels' middle blocks */
const FRONT_OF = (level: number) => new THREE.Vector3(0, (level + 0.5) * BLOCK_HEIGHT, BLOCK_LENGTH / 2 + 0.35)

/** On screen with a margin, and the pinch point lands inside the comfortable part of the webcam frame */
function check(point: THREE.Vector3, camera: THREE.PerspectiveCamera) {
    const ndc = point.clone().project(camera)
    const hand = worldToLandmark(point, camera)
    return {
        visible: Math.max(Math.abs(ndc.x), Math.abs(ndc.y)) <= 0.92,
        // The wrist sits below the pinch point, so the bottom of the frame is out of reach
        reachable: hand.x >= 0.05 && hand.x <= 0.95 && hand.y >= 0.05 && hand.y <= 0.8 && Math.abs(hand.depth) <= 0.9,
        hand,
    }
}

describe('landmark → world mapping', () => {
    it('worldToLandmark inverts landmarkToWorld', () => {
        const camera = orbitCamera(ASPECTS.desktop, 1.1, 40, 0.4)
        for (const [x, y, depth] of [[0.2, 0.3, -0.5], [0.5, 0.45, 0], [0.9, 0.85, 0.8]]) {
            const world = landmarkToWorld({ x, y, z: 0 }, depth, camera)
            const back = worldToLandmark(world, camera)
            expect(back.x).toBeCloseTo(x, 6)
            expect(back.y).toBeCloseTo(y, 6)
            expect(back.depth).toBeCloseTo(depth, 6)
        }
    })

    it.each(Object.entries(ASPECTS))('a landmark appears on screen where it is in the frame (%s) [M-4]', (_, aspect) => {
        const camera = orbitCamera(aspect, 1.2, 40)
        for (const depth of [-0.8, 0, 0.8]) {
            const left = landmarkToWorld({ x: 0.95, y: 0.45, z: 0 }, depth, camera).project(camera)
            const right = landmarkToWorld({ x: 0.05, y: 0.45, z: 0 }, depth, camera).project(camera)
            const top = landmarkToWorld({ x: 0.5, y: 0.02, z: 0 }, depth, camera).project(camera)
            const bottom = landmarkToWorld({ x: 0.5, y: 0.88, z: 0 }, depth, camera).project(camera)
            // Frame edge to edge spans the screen edge to edge, at every depth and aspect
            expect(left.x).toBeLessThan(-0.99)
            expect(right.x).toBeGreaterThan(0.99)
            expect(top.y).toBeGreaterThan(0.99)
            expect(bottom.y).toBeLessThan(-0.99)
        }
    })
})

describe('mirror-AR background [feature #10]', () => {
    it('the video pixel under a landmark is the one it was tracked at, at every layout, orbit and depth', () => {
        const { repeat, offset } = frameTextureTransform()
        for (const aspect of Object.values(ASPECTS)) {
            for (const camera of [orbitCamera(aspect, 1.1, 40, 0.4), orbitCamera(aspect, CAMERA_MIN_POLAR_ANGLE, CAMERA_MIN_DISTANCE, -1.2)]) {
                for (const [x, y, depth] of [[0.2, 0.3, -0.5], [0.5, 0.45, 0], [0.85, 0.8, 0.8]]) {
                    const ndc = landmarkToWorld({ x, y, z: 0 }, depth, camera).project(camera)
                    const screen = { u: (ndc.x + 1) / 2, v: (ndc.y + 1) / 2 }
                    // Texture v = 1 is the frame's top row (flipY)
                    expect(offset[0] + repeat[0] * screen.u).toBeCloseTo(x, 6)
                    expect(offset[1] + repeat[1] * screen.v).toBeCloseTo(1 - y, 6)
                }
            }
        }
    })

    it('the whole screen shows the camera image, none of it past the frame edges', () => {
        const { repeat, offset } = frameTextureTransform()
        for (const corner of [0, 1]) {
            for (const i of [0, 1]) {
                const uv = offset[i] + repeat[i] * corner
                expect(uv).toBeGreaterThanOrEqual(0)
                expect(uv).toBeLessThanOrEqual(1)
            }
        }
    })
})

describe('hand → world', () => {
    it('maps the pinch point exactly and draws the hand at HAND_SCALE around it', () => {
        const camera = orbitCamera(ASPECTS.desktop, 1.2, 40)
        const landmarks = Array.from({ length: 21 }, (_, i) => ({ x: 0.3 + i * 0.01, y: 0.5 - i * 0.008, z: i * 0.001 }))
        const world = handToWorld(landmarks, 0.2, camera, [])
        const pinch = world[4].clone().add(world[8]).multiplyScalar(0.5)
        expect(pinch.distanceTo(landmarkToWorld(pinchAnchor(landmarks), 0.2, camera))).toBeLessThan(1e-9)
        const unscaled = landmarkToWorld(landmarks[0], 0.2, camera).distanceTo(landmarkToWorld(landmarks[20], 0.2, camera))
        expect(world[0].distanceTo(world[20])).toBeCloseTo(unscaled * HAND_SCALE, 9)
    })
})

describe('tower framing and reach [C-3, V-1]', () => {
    it.each(Object.entries(ASPECTS))('the whole tower is on screen and every level is reachable at the default camera (%s)', (_, aspect) => {
        const camera = cameraAt(aspect, new THREE.Vector3(...CAMERA_POSITION))
        for (const point of [TOP_PLACEMENT, FRONT_OF(0), FRONT_OF(TOWER_LEVELS - 1), new THREE.Vector3(0, 0, BLOCK_LENGTH / 2)]) {
            const result = check(point, camera)
            expect(result, `${point.toArray()}`).toMatchObject({ visible: true, reachable: true })
        }
    })

    it.each(Object.entries(ASPECTS))('the top placement point stays visible and reachable across the allowed orbit and zoom (%s)', (_, aspect) => {
        const failures: string[] = []
        for (let polar = CAMERA_MIN_POLAR_ANGLE; polar <= CAMERA_MAX_POLAR_ANGLE + 1e-9; polar += (CAMERA_MAX_POLAR_ANGLE - CAMERA_MIN_POLAR_ANGLE) / 13) {
            for (let distance = CAMERA_MIN_DISTANCE; distance <= CAMERA_MAX_DISTANCE + 1e-9; distance += (CAMERA_MAX_DISTANCE - CAMERA_MIN_DISTANCE) / 4) {
                for (const azimuth of [0, Math.PI / 4, Math.PI / 2]) {
                    const result = check(TOP_PLACEMENT, orbitCamera(aspect, polar, distance, azimuth))
                    if (!result.visible || !result.reachable) {
                        failures.push(`polar ${(polar * 180 / Math.PI).toFixed(0)}° distance ${distance} → ${JSON.stringify(result)}`)
                    }
                }
            }
        }
        expect(failures).toEqual([])
    })
})
