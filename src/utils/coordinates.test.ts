import { describe, it, expect } from 'vitest'
import { normalizeCoordinates } from './coordinates'

describe('normalizeCoordinates', () => {
  it('converts center (0.5, 0.5) to (0, 0)', () => {
    const { x, y } = normalizeCoordinates(0.5, 0.5)
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(0)
  })

  it('inverts X axis (0 -> positive world X)', () => {
    const { x } = normalizeCoordinates(0, 0.5)
    expect(x).toBeGreaterThan(0)
  })

  it('inverts Y axis (0 top -> positive world Y)', () => {
    const { y } = normalizeCoordinates(0.5, 0)
    expect(y).toBeGreaterThan(0)
  })
  
  it('maps 1,1 to negative X, negative Y', () => {
      const { x, y } = normalizeCoordinates(1, 1)
      expect(x).toBeLessThan(0)
      expect(y).toBeLessThan(0)
  })
})
