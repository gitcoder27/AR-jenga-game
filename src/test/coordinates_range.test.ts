import { describe, it, expect } from 'vitest';
import { normalizeCoordinates } from '../utils/coordinates';

describe('Coordinate Mapping Range', () => {
  it('maps center (0.5, 0.5) to expected center with offset', () => {
    const { x, y } = normalizeCoordinates(0.5, 0.5);
    expect(x).toBe(0);
    expect(y).toBe(8.5); // Y_OFFSET
  });

  it('maps edges to expected world bounds with sensitivity', () => {
    const left = normalizeCoordinates(1, 0.5);
    const right = normalizeCoordinates(0, 0.5);
    
    // Physical input 0..1 * sensitivity 1.1 -> effective virtual range wider than +/- 22.5
    expect(Math.abs(left.x)).toBeCloseTo(24.75, 2);
    expect(Math.abs(right.x)).toBeCloseTo(24.75, 2);

    const top = normalizeCoordinates(0.5, 0); 
    const bottom = normalizeCoordinates(0.5, 1);
    
    // ny=0 -> (0.5 - (-0.05))*22 + 8.5 = 12.1 + 8.5 = 20.6
    expect(top.y).toBeCloseTo(20.6, 2);
    // ny=1 -> (0.5 - 1.05)*22 + 8.5 = -12.1 + 8.5 = -3.6
    expect(bottom.y).toBeCloseTo(-3.6, 2);
  });
});