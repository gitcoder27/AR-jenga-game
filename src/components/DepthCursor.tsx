import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { calculateDepth } from '../utils/depth';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import * as THREE from 'three';
import useGesture from '../hooks/useGesture';

interface DepthCursorProps {
  result: HandLandmarkerResult | null;
}

const PARKING_POSITION = new THREE.Vector3(0, -100, 0);

export const DepthCursor: React.FC<DepthCursorProps> = ({ result }) => {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const positionRef = useRef(new THREE.Vector3().copy(PARKING_POSITION));
  const isFirstFrameRef = useRef(true);

  const { isPinching } = useGesture(result?.landmarks?.[0]);

  useFrame(() => {
    if (!result || !result.landmarks || result.landmarks.length === 0) {
      if (!isFirstFrameRef.current && groupRef.current) {
        positionRef.current.copy(PARKING_POSITION);
        groupRef.current.position.copy(PARKING_POSITION);
        isFirstFrameRef.current = true;
      }
      return;
    }

    if (!groupRef.current) return;

    const landmarks = result.landmarks[0];
    const thumb = landmarks[4];
    const index = landmarks[8];

    // Calculate pinch midpoint - this is where the grab will happen
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

    groupRef.current.position.copy(positionRef.current);

    // Make the cursor face the camera
    groupRef.current.lookAt(camera.position);
  });

  const isVisible = !!(result && result.landmarks && result.landmarks.length > 0);

  // Color based on pinch state
  const cursorColor = isPinching ? '#00ff00' : '#ffffff';
  const cursorOpacity = isPinching ? 0.9 : 0.6;

  return (
    <group ref={groupRef} position={[0, -100, 0]} visible={isVisible}>
      {/* Outer ring */}
      <mesh>
        <ringGeometry args={[0.35, 0.4, 32]} />
        <meshBasicMaterial
          color={cursorColor}
          transparent
          opacity={cursorOpacity}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Inner dot - pinch indicator */}
      <mesh>
        <circleGeometry args={[0.08, 16]} />
        <meshBasicMaterial
          color={cursorColor}
          transparent
          opacity={cursorOpacity}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Crosshair lines */}
      <mesh rotation={[0, 0, 0]}>
        <planeGeometry args={[0.02, 0.6]} />
        <meshBasicMaterial color={cursorColor} transparent opacity={cursorOpacity * 0.7} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <planeGeometry args={[0.02, 0.6]} />
        <meshBasicMaterial color={cursorColor} transparent opacity={cursorOpacity * 0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};