import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import { calculateDepth } from '../utils/depth';
import { ema } from '../utils/smoothing';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import * as THREE from 'three';
import useGesture from '../hooks/useGesture';
import { useGameStore } from '../store/gameStore';

interface DepthCursorProps {
  result: HandLandmarkerResult | null;
}

const PARKING_POSITION = new THREE.Vector3(0, -100, 0);
const GRAB_RADIUS = 0.5; // Same radius used in Hand.tsx for pinch detection

// Color states for visual feedback
const COLORS = {
  idle: '#ffffff',      // White: no target nearby
  inRange: '#00e5ff',   // Cyan: target can be grabbed
  grabbing: '#00ff00',  // Green: actively holding
  palm: '#ff9800',      // Orange: open palm mode (camera control)
};

export const DepthCursor: React.FC<DepthCursorProps> = ({ result }) => {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const { world, rapier } = useRapier();
  const positionRef = useRef(new THREE.Vector3().copy(PARKING_POSITION));
  const isFirstFrameRef = useRef(true);
  const proximityRef = useRef(0); // 0-1 proximity to nearest block
  const isInRangeRef = useRef(false);

  const { isPinching, isClosedFist, confidence } = useGesture(result?.landmarks?.[0]);
  const setHoveredBlockId = useGameStore((state) => state.setHoveredBlockId);
  const hoveredBlockIdRef = useRef<string | null>(null);

  useFrame(() => {
    if (!result || !result.landmarks || result.landmarks.length === 0) {
      if (!isFirstFrameRef.current && groupRef.current) {
        positionRef.current.copy(PARKING_POSITION);
        groupRef.current.position.copy(PARKING_POSITION);
        isFirstFrameRef.current = true;
        proximityRef.current = 0;
        isInRangeRef.current = false;
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
      // Use EMA for very smooth cursor movement
      positionRef.current.x = ema(positionRef.current.x, worldPos.x, 0.2);
      positionRef.current.y = ema(positionRef.current.y, worldPos.y, 0.2);
      positionRef.current.z = ema(positionRef.current.z, worldPos.z, 0.2);
    }

    groupRef.current.position.copy(positionRef.current);

    // Proximity detection: check if we're near any grabbable block
    try {
      const shape = new rapier.Ball(GRAB_RADIUS * 2); // Slightly larger for proximity detection
      const hit = world.intersectionWithShape(
        { x: positionRef.current.x, y: positionRef.current.y, z: positionRef.current.z },
        { x: 0, y: 0, z: 0, w: 1 },
        shape
      );

      if (hit) {
        const body = hit.parent();
        if (body && body.isDynamic()) {
          // Get the block name for highlighting
          const rigidBody = body as any;
          const blockName = rigidBody.userData?.name || '';

          // Set hovered block if it's a block
          if (blockName.startsWith('block-')) {
            if (hoveredBlockIdRef.current !== blockName) {
              hoveredBlockIdRef.current = blockName;
              setHoveredBlockId(blockName);
            }
          } else {
            if (hoveredBlockIdRef.current !== null) {
              hoveredBlockIdRef.current = null;
              setHoveredBlockId(null);
            }
          }

          // Calculate proximity based on distance
          const bodyPos = body.translation();
          const dist = Math.sqrt(
            Math.pow(positionRef.current.x - bodyPos.x, 2) +
            Math.pow(positionRef.current.y - bodyPos.y, 2) +
            Math.pow(positionRef.current.z - bodyPos.z, 2)
          );
          // Normalize to 0-1 (1 = very close, 0 = at edge of detection)
          proximityRef.current = Math.max(0, 1 - dist / (GRAB_RADIUS * 2));
          isInRangeRef.current = dist < GRAB_RADIUS;
        } else {
          if (hoveredBlockIdRef.current !== null) {
            hoveredBlockIdRef.current = null;
            setHoveredBlockId(null);
          }
          proximityRef.current = 0;
          isInRangeRef.current = false;
        }
      } else {
        if (hoveredBlockIdRef.current !== null) {
          hoveredBlockIdRef.current = null;
          setHoveredBlockId(null);
        }
        proximityRef.current = ema(proximityRef.current, 0, 0.1);
        isInRangeRef.current = false;
      }
    } catch {
      // Rapier may error during initialization
      proximityRef.current = 0;
      isInRangeRef.current = false;
    }

    // Make the cursor face the camera
    groupRef.current.lookAt(camera.position);
  });

  const isVisible = !!(result && result.landmarks && result.landmarks.length > 0);

  // Determine cursor color based on state
  const getCursorColor = () => {
    if (isClosedFist) return COLORS.palm;
    if (isPinching) return COLORS.grabbing;
    if (isInRangeRef.current) return COLORS.inRange;
    return COLORS.idle;
  };

  const cursorColor = getCursorColor();

  // Opacity increases with proximity and gesture confidence
  const baseOpacity = isPinching ? 0.95 : isClosedFist ? 0.85 : 0.65;
  const proximityBoost = proximityRef.current * 0.2;
  const cursorOpacity = Math.min(1, baseOpacity + proximityBoost);

  // Ring scale pulses based on proximity (larger when close to target)
  const ringScale = 1 + proximityRef.current * 0.3;

  return (
    <group ref={groupRef} position={[0, -100, 0]} visible={isVisible}>
      {/* Outer ring - pulses with proximity */}
      <mesh scale={[ringScale, ringScale, 1]}>
        <ringGeometry args={[0.35, 0.4, 32]} />
        <meshBasicMaterial
          color={cursorColor}
          transparent
          opacity={cursorOpacity * 0.9}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Secondary ring - shows when in grab range */}
      {isInRangeRef.current && (
        <mesh scale={[1.3, 1.3, 1]}>
          <ringGeometry args={[0.45, 0.48, 32]} />
          <meshBasicMaterial
            color={cursorColor}
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Inner dot - pinch indicator, grows with confidence */}
      <mesh scale={[1 + confidence * 0.3, 1 + confidence * 0.3, 1]}>
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

      {/* Grab sphere visualization - shows when pinching and in range */}
      {isPinching && isInRangeRef.current && (
        <mesh>
          <sphereGeometry args={[GRAB_RADIUS, 16, 16]} />
          <meshBasicMaterial
            color={COLORS.grabbing}
            transparent
            opacity={0.15}
            wireframe
          />
        </mesh>
      )}
    </group>
  );
};