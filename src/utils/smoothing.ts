/**
 * Smoothing utilities for hand tracking
 */

/**
 * Standard linear interpolation
 */
export function lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
}

/**
 * Velocity-aware adaptive smoothing
 * 
 * Fast movements → less smoothing (responsive)
 * Slow movements → more smoothing (stable)
 * 
 * @param start Current value
 * @param end Target value
 * @param velocity Movement velocity (distance moved per frame)
 * @param minT Minimum smoothing factor for slow movements
 * @param maxT Maximum smoothing factor for fast movements
 */
export function adaptiveLerp(
    start: number,
    end: number,
    velocity: number = 0,
    minT: number = 0.08,
    maxT: number = 0.30
): number {
    // Scale smoothing factor based on velocity
    // Higher velocity → higher t → less smoothing
    const velocityFactor = Math.min(1, velocity * 2); // Normalize velocity
    const t = lerp(minT, maxT, velocityFactor);

    return lerp(start, end, Math.max(minT, Math.min(maxT, t)));
}

/**
 * Exponential moving average for very smooth transitions
 * Good for UI elements that shouldn't jitter
 */
export function ema(currentValue: number, newValue: number, alpha: number = 0.1): number {
    return alpha * newValue + (1 - alpha) * currentValue;
}

/**
 * Calculate velocity from two positions
 */
export function calculateVelocity(
    prev: { x: number; y: number; z: number },
    next: { x: number; y: number; z: number }
): number {
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const dz = next.z - prev.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}