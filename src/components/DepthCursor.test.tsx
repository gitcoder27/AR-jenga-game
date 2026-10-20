import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DepthCursor } from './DepthCursor';
import { cursorLook } from './cursorLook';
import { NO_FEEDBACK, type CursorFeedback, type HandPhysics, type Vec3 } from '../game/grab';

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: vi.fn(() => ({ camera: { position: new THREE.Vector3(0, 10, 20) } })),
}));

// Stand-in for HandPhysics: the cursor only reads the pinch point and the feedback.
function fakeHand(pinchPoint: Vec3 | null, feedback: CursorFeedback = NO_FEEDBACK) {
  return { pinchPoint, feedback } as unknown as HandPhysics;
}

const gesture = (isPinching: boolean, isOpenPalm = false, confidence = 0) => ({ isPinching, isOpenPalm, confidence });

describe('DepthCursor', () => {
  it('registers a frame callback that tolerates unmounted refs', () => {
    vi.mocked(useFrame).mockClear();
    render(<DepthCursor handPhysics={fakeHand(null)} handRef={{ current: null }} />);
    const callback = vi.mocked(useFrame).mock.calls[0][0];
    expect(() => callback({} as never, 0)).not.toThrow();
  });

  it('never re-renders on its own: no store subscriptions (M-1)', () => {
    vi.mocked(useFrame).mockClear();
    render(<DepthCursor handPhysics={fakeHand({ x: 0, y: 0, z: 0 })} handRef={{ current: null }} />);
    expect(vi.mocked(useFrame)).toHaveBeenCalledTimes(1);
  });
});

describe('cursorLook', () => {
  it('shows the grab sphere only when pinching while a block is in range', () => {
    expect(cursorLook(gesture(true), true).grabSphere).toBe(true);
    expect(cursorLook(gesture(true), false).grabSphere).toBe(false);
    expect(cursorLook(gesture(false), true).grabSphere).toBe(false);
  });

  it('colours: open palm, then pinching, then in range, then idle', () => {
    expect(cursorLook(gesture(false, true), true).color).toBe('#ff9800');
    expect(cursorLook(gesture(true), true).color).toBe('#00ff00');
    expect(cursorLook(gesture(false), true).color).toBe('#00e5ff');
    expect(cursorLook(null, false).color).toBe('#ffffff');
  });

  it('the inner dot grows with confidence', () => {
    expect(cursorLook(gesture(true, false, 1), false).dotScale).toBeCloseTo(1.3);
    expect(cursorLook(null, false).dotScale).toBe(1);
  });
});
