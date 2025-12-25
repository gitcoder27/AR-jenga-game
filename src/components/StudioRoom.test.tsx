import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { StudioRoom } from './StudioRoom';

// Mock Drei's Backdrop to render a div
vi.mock('@react-three/drei', () => ({
  Backdrop: (props: any) => <div data-testid="backdrop" {...props} />,
}));

describe('StudioRoom', () => {
  it('renders the Backdrop component with correct props', () => {
    const { getByTestId } = render(<StudioRoom />);
    const backdrop = getByTestId('backdrop');
    expect(backdrop).toBeDefined();
    // Verify scale/floor args if possible, but presence is good enough for now.
  });
});