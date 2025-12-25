import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { WoodMaterial } from './WoodMaterial';

vi.mock('@react-three/drei', () => ({
  useTexture: vi.fn().mockReturnValue({}), // Mock texture load
}));

describe('WoodMaterial', () => {
  it('renders a meshStandardMaterial', () => {
    // We expect it to return a <meshStandardMaterial />
    // Mocks for R3F elements in RTL environment usually render standard HTML tags if not handled.
    // We just want to ensure it doesn't crash.
    const { container } = render(<WoodMaterial />);
    expect(container).toBeDefined();
  });
});
