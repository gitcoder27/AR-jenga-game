import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DepthCursor } from './DepthCursor';
import { NO_FEEDBACK, type CursorFeedback, type HandPhysics, type Vec3 } from '../game/grab';
import { useGameStore } from '../store/gameStore';

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: vi.fn(() => ({ camera: { position: new THREE.Vector3(0, 10, 20) } })),
}));

// Stand-in for HandPhysics: the cursor only reads the pinch point and the feedback.
function fakeHand(pinchPoint: Vec3 | null, feedback: CursorFeedback = NO_FEEDBACK) {
  return { pinchPoint, feedback } as unknown as HandPhysics;
}

function renderCursor(hand: HandPhysics) {
  vi.mocked(useFrame).mockClear();
  return render(<DepthCursor handPhysics={hand} isPinching={false} isOpenPalm={false} confidence={0} />);
}

describe('DepthCursor', () => {
  beforeEach(() => {
    act(() => useGameStore.getState().setHoveredBlockId(null));
  });

  it('registers a frame callback that tolerates unmounted refs', () => {
    renderCursor(fakeHand(null));
    const callback = vi.mocked(useFrame).mock.calls[0][0];
    expect(() => callback({} as never, 0)).not.toThrow();
  });

  it('shows the grab sphere only when pinching while a block is in range', () => {
    const hand = fakeHand({ x: 0, y: 0, z: 0 });
    const { container, rerender } = render(<DepthCursor handPhysics={hand} isPinching isOpenPalm={false} confidence={1} />);
    const meshes = () => container.querySelectorAll('mesh').length;
    const outOfRange = meshes();

    act(() => useGameStore.getState().setHoveredBlockId('2-0'));
    rerender(<DepthCursor handPhysics={hand} isPinching isOpenPalm={false} confidence={1} />);
    // In range: the secondary ring and the grab sphere appear.
    expect(meshes()).toBe(outOfRange + 2);
  });
});
