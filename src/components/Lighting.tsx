import React from 'react';

export const Lighting: React.FC = () => {
  return (
    <>
      <ambientLight intensity={0.4} />
      {/* Key light high above the tower; its shadow frustum covers the whole
          27-unit tower and the table (F-3). */}
      <directionalLight
        castShadow
        position={[15, 40, 15]}
        intensity={1.5}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      >
        <orthographicCamera attach="shadow-camera" args={[-14, 14, 14, -14, 1, 80]} />
      </directionalLight>
    </>
  );
};
