import React from 'react';
import { Environment } from '@react-three/drei';

export const EnvironmentSetup: React.FC = () => {
  return (
    <Environment preset="studio" background={false} />
  );
};
