/** Depth in [-1, 1] (+1 nearest the viewer) → % from the gauge's top (far) */
const toPercent = (depth: number) => ((Math.max(-1, Math.min(1, depth)) + 1) / 2) * 100;

/**
 * The depth gauge's DOM nodes (H-3). DepthGauge attaches them from outside
 * the Canvas, and DepthGaugeSync moves them every frame from inside it, so
 * the gauge never re-renders (M-1).
 */
export class DepthGaugeView {
    private root: HTMLElement | null = null;
    private band: HTMLElement | null = null;
    private hand: HTMLElement | null = null;

    attach(part: 'root' | 'band' | 'hand', el: HTMLElement | null): void {
        this[part] = el;
    }

    /** Hidden with no hand; otherwise the hand's depth and the tower's front and back, all in [-1, 1] */
    show(depths: { hand: number; front: number; back: number } | null): void {
        if (!this.root || !this.band || !this.hand) return;
        this.root.style.visibility = depths ? 'visible' : 'hidden';
        if (!depths) return;
        const top = toPercent(depths.back), bottom = toPercent(depths.front);
        this.band.style.top = `${top}%`;
        this.band.style.height = `${Math.max(bottom - top, 1)}%`;
        this.hand.style.top = `${toPercent(depths.hand)}%`;
    }
}
