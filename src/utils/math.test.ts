import { describe, it, expect } from 'vitest'
import { calculateDistance } from './math'

describe('calculateDistance', () => {
  it('calculates distance between two 3D points', () => {
    const p1 = { x: 0, y: 0, z: 0 }
    const p2 = { x: 3, y: 4, z: 0 }
    
    // 3-4-5 triangle
    expect(calculateDistance(p1, p2)).toBeCloseTo(5)
  })

  it('calculates distance with z axis', () => {
    const p1 = { x: 0, y: 0, z: 0 }
    const p2 = { x: 0, y: 0, z: 10 }
    
    expect(calculateDistance(p1, p2)).toBe(10)
  })
})
