import React, { Component, Suspense, type ReactNode } from 'react';
import { Environment } from '@react-three/drei';
import { STUDIO_HDR_PATH } from '../tracking/assets';

/** If the HDR can't load, carry on without reflections instead of crashing the scene (O-3). */
class EnvironmentFallback extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn('Environment map unavailable, continuing without it:', error.message);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export const EnvironmentSetup: React.FC = () => {
  return (
    <EnvironmentFallback>
      {/* The rest of the scene renders while the HDR loads */}
      <Suspense fallback={null}>
        <Environment files={STUDIO_HDR_PATH} background={false} />
      </Suspense>
    </EnvironmentFallback>
  );
};
