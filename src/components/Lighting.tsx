import React from 'react';

export const Lighting: React.FC = () => {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight 
        castShadow 
        position={[5, 10, 5]} 
        intensity={1.5}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      >
        <orthographicCamera attach="shadow-camera" args={[-10, 10, 10, -10]} />
      </directionalLight>
    </>
  );
};
