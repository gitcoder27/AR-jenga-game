import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { HandBone } from './HandBone';
import type { ComponentProps } from 'react';

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
}));

describe('HandBone', () => {
  it('renders without crashing', () => {
    const refs: ComponentProps<typeof HandBone>['refs'] = { current: [] };
    const { container } = render(<HandBone refs={refs} startIdx={0} endIdx={1} />);
    expect(container).toBeDefined();
  });
});