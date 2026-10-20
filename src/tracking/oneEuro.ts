/**
 * One Euro filter (Casiez, Roussel & Vogel, CHI 2012): a low-pass filter whose
 * cutoff rises with speed, so a still hand is steady and a moving one has
 * little lag. Driven by real timestamps, so it behaves the same at any frame rate.
 */
export interface OneEuroParams {
    /** Cutoff at rest (Hz): lower is steadier */
    minCutoff: number;
    /** How fast the cutoff rises with speed (per unit/s): higher is less lag when moving */
    beta: number;
    /** Cutoff for the speed estimate (Hz) */
    dCutoff: number;
}

function alpha(dt: number, cutoff: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
}

export class OneEuroFilter {
    private x: number | null = null;
    private dx = 0;
    private readonly params: OneEuroParams;

    constructor(params: OneEuroParams) {
        this.params = params;
    }

    /** Filter `value`, `dt` seconds after the previous sample. */
    filter(value: number, dt: number): number {
        if (this.x === null || dt <= 0) {
            this.x ??= value;
            return this.x;
        }
        const { minCutoff, beta, dCutoff } = this.params;
        const rawDx = (value - this.x) / dt;
        this.dx += alpha(dt, dCutoff) * (rawDx - this.dx);
        const cutoff = minCutoff + beta * Math.abs(this.dx);
        this.x += alpha(dt, cutoff) * (value - this.x);
        return this.x;
    }

    reset(): void {
        this.x = null;
        this.dx = 0;
    }
}
