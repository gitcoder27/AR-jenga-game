import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GRAB_RADIUS } from '../game/config';
import type { HandPhysics } from '../game/grab';
import { useGameStore } from '../store/gameStore';

interface DepthCursorProps {
  /** Source of the pinch point and the grab candidate; the cursor shows exactly what a pinch would do. */
  handPhysics: HandPhysics;
  isPinching: boolean;
  isClosedFist: boolean;
  confidence: number;
}

// Color states for visual feedback
const COLORS = {
  idle: '#ffffff',      // White: no target nearby
  inRange: '#00e5ff',   // Cyan: target can be grabbed
  grabbing: '#00ff00',  // Green: actively holding
  palm: '#ff9800',      // Orange: open palm mode (camera control)
  missed: '#ff5252',    // Red: pinched on nothing; reopen to try again (G-4)
};

/**
 * Cursor at the pinch point. "In range" comes from the same per-frame grab
 * candidate HandPhysics grabs with (F-1, F-2). Position and the proximity pulse
 * are applied imperatively; React re-renders only when the hover target changes.
 */
export const DepthCursor: React.FC<DepthCursorProps> = ({ handPhysics, isPinching, isClosedFist, confidence }) => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const missedRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const isInRange = useGameStore((state) => state.hoveredBlockId !== null);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const pinch = handPhysics.pinchPoint;
    group.visible = pinch !== null;
    if (!pinch) return;
    group.position.set(pinch.x, pinch.y, pinch.z);
    // Make the cursor face the camera
    group.lookAt(camera.position);
    // Ring grows as the pinch point nears a block
    const ringScale = 1 + handPhysics.feedback.proximity * 0.3;
    ringRef.current?.scale.set(ringScale, ringScale, 1);
    if (missedRef.current) missedRef.current.visible = handPhysics.pinchMissed;
  });

  // Determine cursor color based on state
  const getCursorColor = () => {
    if (isClosedFist) return COLORS.palm;
    if (isPinching) return COLORS.grabbing;
    if (isInRange) return COLORS.inRange;
    return COLORS.idle;
  };

  const cursorColor = getCursorColor();
  const cursorOpacity = isPinching ? 0.95 : isClosedFist ? 0.85 : isInRange ? 0.8 : 0.65;

  return (
    <group ref={groupRef} position={[0, -100, 0]} visible={false}>
      {/* Outer ring - pulses with proximity */}
      <mesh ref={ringRef}>
        <ringGeometry args={[0.35, 0.4, 32]} />
        <meshBasicMaterial
          color={cursorColor}
          transparent
          opacity={cursorOpacity * 0.9}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Secondary ring - shows when in grab range */}
      {isInRange && (
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

      {/* Missed pinch - closed on nothing, won't grab until the hand reopens */}
      <mesh ref={missedRef} visible={false} scale={[1.3, 1.3, 1]}>
        <ringGeometry args={[0.45, 0.5, 32]} />
        <meshBasicMaterial color={COLORS.missed} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>

      {/* Grab sphere visualization - shows when pinching and in range */}
      {isPinching && isInRange && (
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
