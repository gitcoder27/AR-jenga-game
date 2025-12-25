import { describe, it, expect } from 'vitest'
import { lerp } from './smoothing'

describe('lerp', () => {
    it('interpolates between values', () => {
        expect(lerp(0, 10, 0.5)).toBe(5)
    })
    
    it('returns target when factor is 1', () => {
        expect(lerp(0, 10, 1)).toBe(10)
    })
    
    it('returns current when factor is 0', () => {
        expect(lerp(0, 10, 0)).toBe(0)
    })
})
