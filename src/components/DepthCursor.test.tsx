import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DepthCursor } from './DepthCursor';
import { useFrame } from '@react-three/fiber';

// Mock Drei's Ring
vi.mock('@react-three/drei', () => ({
  Ring: (props: any) => <div data-testid="depth-cursor" {...props} />,
}));

// Mock useFrame
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: vi.fn(() => ({
    camera: {
      position: { x: 0, y: 10, z: 20 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
    }
  })),
  extend: vi.fn(),
}));


describe('DepthCursor', () => {
  it('is hidden when result is null', () => {
    const { getByTestId } = render(<DepthCursor result={null} />);
    const cursor = getByTestId('depth-cursor');
    // React omits boolean false attributes on DOM elements
    expect(cursor.getAttribute('visible')).toBeNull();
  });

  it('renders cursor when result is provided and updates without crash', () => {
    // Create a mock result with enough landmarks
    const landmarks = Array(21).fill(0).map((_, i) => ({ x: i * 0.01, y: i * 0.01, z: 0 }));
    const mockResult = { landmarks: [landmarks] };

    const { getByTestId } = render(<DepthCursor result={mockResult as any} />);
    expect(getByTestId('depth-cursor')).toBeDefined();

    // Verify useFrame logic
    const useFrameMock = vi.mocked(useFrame);
    // Get the callback passed to useFrame
    const callback = useFrameMock.mock.calls[0][0];

    // Execute it. Should not throw.
    expect(() => callback({} as any, 0)).not.toThrow();
  });
});