import * as THREE from 'three';
import type { HandGesture } from '../tracking/handTracker';

// Color states for visual feedback
export const CURSOR_COLORS = {
  idle: '#ffffff',      // White: no target nearby
  inRange: '#00e5ff',   // Cyan: target can be grabbed
  grabbing: '#00ff00',  // Green: actively holding
  palm: '#ff9800',      // Orange: open palm mode (camera control)
  missed: '#ff5252',    // Red: pinched on nothing; reopen to try again (G-4)
};

export interface CursorLook {
  color: string;
  opacity: number;
  /** The secondary ring: a pinch here would grab */
  inRange: boolean;
  /** The grab sphere: pinching while a block is in range */
  grabSphere: boolean;
  /** Inner dot scale, grows with gesture confidence */
  dotScale: number;
}

/** What the cursor looks like for a gesture, and whether a block is in grab range. */
export function cursorLook(gesture: Pick<HandGesture, 'isPinching' | 'isOpenPalm' | 'confidence'> | null, inRange: boolean): CursorLook {
  const isPinching = gesture?.isPinching ?? false;
  const isOpenPalm = gesture?.isOpenPalm ?? false;
  const color = isOpenPalm ? CURSOR_COLORS.palm : isPinching ? CURSOR_COLORS.grabbing : inRange ? CURSOR_COLORS.inRange : CURSOR_COLORS.idle;
  const opacity = isPinching ? 0.95 : isOpenPalm ? 0.85 : inRange ? 0.8 : 0.65;
  return { color, opacity, inRange, grabSphere: isPinching && inRange, dotScale: 1 + (gesture?.confidence ?? 0) * 0.3 };
}

/** The cursor's recolourable materials, updated in place every frame (F-7). */
export class CursorMaterials {
  private static basic(opacity: number) {
    return new THREE.MeshBasicMaterial({ color: CURSOR_COLORS.idle, transparent: true, opacity, side: THREE.DoubleSide });
  }
  readonly ring = CursorMaterials.basic(0.6);
  readonly inRange = CursorMaterials.basic(0.4);
  readonly dot = CursorMaterials.basic(0.65);
  readonly cross = CursorMaterials.basic(0.45);
  readonly dropLine = new THREE.MeshBasicMaterial({ color: CURSOR_COLORS.idle, transparent: true, opacity: 0.35, depthWrite: false });
  readonly sphere = new THREE.MeshBasicMaterial({ color: CURSOR_COLORS.grabbing, transparent: true, opacity: 0.15, wireframe: true });

  apply(look: CursorLook): void {
    for (const m of [this.ring, this.inRange, this.dot, this.cross, this.dropLine]) m.color.set(look.color);
    this.ring.opacity = look.opacity * 0.9;
    this.dot.opacity = look.opacity;
    this.cross.opacity = look.opacity * 0.7;
  }

  dispose(): void {
    for (const m of [this.ring, this.inRange, this.dot, this.cross, this.dropLine, this.sphere]) m.dispose();
  }
}
