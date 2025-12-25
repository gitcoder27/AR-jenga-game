import { describe, it, expect } from 'vitest'
import { calculateDepth } from './depth'

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
