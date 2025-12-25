import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { EnvironmentSetup } from './EnvironmentSetup';

// Mock Drei's Environment component to render a simple div that we can query in the DOM
vi.mock('@react-three/drei', () => ({
  Environment: (props: any) => <div data-testid="environment" {...props} />,
}));

describe('EnvironmentSetup', () => {
  it('renders the Environment component with correct props', () => {
    // Render without Canvas since we are mocking the child to be a DOM element
    // and EnvironmentSetup itself is a pure component (no hooks used directly in it that need context)
    const { getByTestId } = render(<EnvironmentSetup />);

    const env = getByTestId('environment');
    expect(env).toBeDefined();
    expect(env.getAttribute('preset')).toBe('studio');
    // background={false} might not appear as an attribute if it's boolean false, 
    // or it might appear depending on how React handles it for divs.
    // If it's a boolean false, it won't be in the DOM.
    // We can check if 'background' attribute is missing (null) which implies it wasn't true? 
    // Or just trust the preset for now.
    
    // Actually, let's just check the text content if we pass it, or just existence.
  });
});