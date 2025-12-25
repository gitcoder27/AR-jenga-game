import { describe, it, expect } from 'vitest';
import { normalizeCoordinates } from '../utils/coordinates';

describe('Coordinate Mapping Range', () => {
  it('maps center (0.5, 0.5) to (0, 0)', () => {
    const { x, y } = normalizeCoordinates(0.5, 0.5);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });

  it('maps edges to expected world bounds', () => {
    // Current expectation: Input 0 -> Width/2, Input 1 -> -Width/2
    // We want to ensure the range is sufficient. 
    // Let's assume we want at least +/- 25 units in X and +/- 20 in Y to cover the wider FOV.
    
    const left = normalizeCoordinates(1, 0.5); // MediaPipe X=1 is user's left (mirrored) -> negative world X
    const right = normalizeCoordinates(0, 0.5); // MediaPipe X=0 is user's right (mirrored) -> positive world X
    
    // We want to expand from 40/30 to maybe 50/40.
    // So expected X range should be larger than 20.
    expect(Math.abs(left.x)).toBeGreaterThan(20);
    expect(Math.abs(right.x)).toBeGreaterThan(20);

    const top = normalizeCoordinates(0.5, 0); // Y=0 is top -> positive world Y
    const bottom = normalizeCoordinates(0.5, 1); // Y=1 is bottom -> negative world Y
    
    expect(Math.abs(top.y)).toBeGreaterThan(15);
    expect(Math.abs(bottom.y)).toBeGreaterThan(15);
  });
});
