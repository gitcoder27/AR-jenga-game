import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Lighting } from './Lighting';

// Mock Drei/Three components
vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ scene: { add: vi.fn(), remove: vi.fn() } }), // dummy context
}));

// Mock lights as simple divs for testing props
vi.mock('three', () => ({
    DirectionalLight: class {},
    AmbientLight: class {}
}));

describe('Lighting', () => {
  it('renders without crashing', () => {
    // Since Lighting uses only standard JSX elements corresponding to Three.js objects (ambientLight, directionalLight),
    // and we aren't testing the actual Three.js shadow rendering (integration test), 
    // we just check if it renders successfully.
    // However, to check props, we might need to inspect the rendered output if we mock them as DOM elements.
    
    // Actually, R3F elements like <directionalLight /> are difficult to spy on with standard RTL without custom renderers.
    // For now, simple smoke test.
    const { container } = render(<Lighting />);
    expect(container).toBeDefined();
  });
});
