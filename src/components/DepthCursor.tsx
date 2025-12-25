import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Ring } from '@react-three/drei';
import { calculateDepth } from '../utils/depth';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import * as THREE from 'three';

interface DepthCursorProps {
  result: HandLandmarkerResult | null;
}

const PARKING_POSITION = new THREE.Vector3(0, -100, 0);

export const DepthCursor: React.FC<DepthCursorProps> = ({ result }) => {
  const cursorRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
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
    const handZ = calculateDepth(landmarks);

    // Viewport parameters matching Hand.tsx
    const VIEW_WIDTH = 45;
    const VIEW_HEIGHT = 25;
    const BASE_DIST = 20;

    // Use same explicit local-to-camera transform as Hand.tsx
    const lx = (midX - 0.5) * VIEW_WIDTH * -1;
    const ly = (0.5 - midY) * VIEW_HEIGHT;
    const lz = -(BASE_DIST - handZ) - (midZRaw * 10);

    // Transform to camera-relative world position
    const localPos = new THREE.Vector3(lx, ly, lz);

    const worldPos = localPos.applyQuaternion(camera.quaternion).add(camera.position);

    if (isFirstFrameRef.current) {
      positionRef.current.copy(worldPos);
      isFirstFrameRef.current = false;
    } else {
      positionRef.current.lerp(worldPos, 0.2);
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