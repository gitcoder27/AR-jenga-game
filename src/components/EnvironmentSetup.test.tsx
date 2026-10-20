import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { EnvironmentSetup } from './EnvironmentSetup';
import { STUDIO_HDR_PATH } from '../tracking/assets';

let failToLoad = false;

// Render drei's Environment as a DOM element we can query
vi.mock('@react-three/drei', () => ({
  Environment: ({ files }: { files: string }) => {
    if (failToLoad) throw new Error('Could not load studio_small_03_1k.hdr: Failed to fetch');
    return <div data-testid="environment" data-files={files} />;
  },
}));

describe('EnvironmentSetup', () => {
  it('loads the self-hosted studio HDR, not a CDN preset (O-3)', () => {
    failToLoad = false;
    const { getByTestId } = render(<EnvironmentSetup />);
    expect(getByTestId('environment').dataset.files).toBe(STUDIO_HDR_PATH);
    expect(STUDIO_HDR_PATH).not.toMatch(/^https?:/);
  });

  it('renders nothing instead of crashing when the HDR fails to load', () => {
    failToLoad = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<EnvironmentSetup />);
    expect(container.innerHTML).toBe('');
  });
});
