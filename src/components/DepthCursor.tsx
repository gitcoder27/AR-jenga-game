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

const PARKING_POSITION = new THREE.Vector3(0, -100, 0);

export const DepthCursor: React.FC<DepthCursorProps> = ({ result }) => {
  const cursorRef = useRef<THREE.Mesh>(null);
  const positionRef = useRef(new THREE.Vector3().copy(PARKING_POSITION));
  const isFirstFrameRef = useRef(true);

  useFrame(() => {
    if (!result || !result.landmarks || result.landmarks.length === 0) {
        if (!isFirstFrameRef.current && cursorRef.current) {
            positionRef.current.copy(PARKING_POSITION);
            cursorRef.current.position.copy(PARKING_POSITION);
            isFirstFrameRef.current = true;
        }
        return;
    }

    if (!cursorRef.current) return;

    const landmarks = result.landmarks[0];
    const thumb = landmarks[4];
    const index = landmarks[8];
    
    const midX = (thumb.x + index.x) / 2;
    const midY = (thumb.y + index.y) / 2;
    const midZRaw = (thumb.z + index.z) / 2;

    const { x } = normalizeCoordinates(midX, midY);
    const handZ = calculateDepth(landmarks);
    const z = handZ + (midZRaw * -10);
    
    const targetPos = new THREE.Vector3(x, 0.05, z);
    
    if (isFirstFrameRef.current) {
        positionRef.current.copy(targetPos);
        isFirstFrameRef.current = false;
    } else {
        positionRef.current.lerp(targetPos, 0.2);
    }

    cursorRef.current.position.copy(positionRef.current);
  });

  const isVisible = !!(result && result.landmarks && result.landmarks.length > 0);

  return (
    <Ring 
        ref={cursorRef} 
        args={[0.3, 0.4, 32]} 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -100, 0]} // Initial parking
        visible={isVisible}
    >
      <meshBasicMaterial color="cyan" transparent opacity={0.5} side={THREE.DoubleSide} />
    </Ring>
  );
};