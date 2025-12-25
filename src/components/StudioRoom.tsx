import React from 'react';
import { Backdrop } from '@react-three/drei';

export const StudioRoom: React.FC = () => {
  return (
    <Backdrop
      receiveShadow
      scale={[50, 20, 20]}
      floor={10} // Stretches the floor segment, 0 = no floor
      position={[0, -5, -10]} // Position it behind the table
      segments={20} // Mesh resolution
    >
      <meshStandardMaterial color="#333" roughness={1} />
    </Backdrop>
  );
};
