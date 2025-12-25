import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Ring } from '@react-three/drei';
import { normalizeCoordinates } from '../utils/coordinates';
import { calculateDepth } from '../utils/depth';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import * as THREE from 'three';

interface DepthCursorProps {
  result: HandLandmarkerResult | null;
}

export const DepthCursor: React.FC<DepthCursorProps> = ({ result }) => {
  const cursorRef = useRef<THREE.Mesh>(null);
  const positionRef = useRef(new THREE.Vector3(0, 0.1, 0)); // Start slightly above 0 to avoid z-fighting

  useFrame(() => {
    if (!cursorRef.current || !result || !result.landmarks || result.landmarks.length === 0) return;

    const landmarks = result.landmarks[0];
    // Use Thumb Tip (4) and Index Finger Tip (8) for cursor position
    const thumb = landmarks[4];
    const index = landmarks[8];
    
    const midX = (thumb.x + index.x) / 2;
    const midY = (thumb.y + index.y) / 2;
    // Landmark Z is relative to wrist in MediaPipe (roughly). 
    // We need to apply the same depth logic as Hand.tsx
    const midZRaw = (thumb.z + index.z) / 2;

    const { x, y } = normalizeCoordinates(midX, midY);
    const handZ = calculateDepth(landmarks);
    const z = handZ + (midZRaw * -10);
    
    // Smooth the target position
    const targetPos = new THREE.Vector3(x, 0.05, z);
    
    // We can use the same smoothing util, but it expects a ref to a vector.
    // Let's manually lerp here for simplicity or adapt the util.
    // Actually, `smoothCoordinates` updates a Ref's current value.
    // Let's just do simple lerp here since it's just a visual guide.
    positionRef.current.lerp(targetPos, 0.2);

    cursorRef.current.position.copy(positionRef.current);
  });

  if (!result || !result.landmarks || result.landmarks.length === 0) return null;

  return (
    <Ring 
        ref={cursorRef} 
        args={[0.3, 0.4, 32]} 
        rotation={[-Math.PI / 2, 0, 0]} // Flat on floor
        position={[0, 0.05, 0]} 
    >
      <meshBasicMaterial color="cyan" transparent opacity={0.5} side={THREE.DoubleSide} />
    </Ring>
  );
};
