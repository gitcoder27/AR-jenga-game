import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GRAB_RADIUS } from '../game/config';
import type { HandPhysics } from '../game/grab';
import type { TrackedHand } from '../tracking/handTracker';
import type { CameraClutch } from '../tracking/cameraClutch';
import { useGameStore } from '../store/gameStore';
import { CURSOR_COLORS, CursorMaterials, cursorLook } from './cursorLook';

interface DepthCursorProps {
  /** Source of the pinch point and the grab candidate; the cursor shows exactly what a pinch would do. */
  handPhysics: HandPhysics;
  /** The tracked hand, read every frame (M-1) */
  handRef: React.RefObject<TrackedHand | null>;
  /** Camera-mode hold progress: a disc fills the ring as an open palm is held still (H-2) */
  clutch: CameraClutch;
}

/**
 * Cursor at the pinch point. "In range" comes from the same per-frame grab
 * candidate HandPhysics grabs with (F-1, F-2), and the gesture from the same
 * tracked hand (H-7). Everything is applied imperatively in the frame loop,
 * so the cursor never re-renders (M-1, F-7).
 */
export const DepthCursor: React.FC<DepthCursorProps> = ({ handPhysics, handRef, clutch }) => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const inRangeRef = useRef<THREE.Mesh>(null);
  const dotRef = useRef<THREE.Mesh>(null);
  const sphereRef = useRef<THREE.Mesh>(null);
  const missedRef = useRef<THREE.Mesh>(null);
  const holdRef = useRef<THREE.Mesh>(null);
  const dropRef = useRef<THREE.Group>(null);
  const dropLineRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  // Materials whose colour and opacity follow the cursor state
  const materials = useMemo(() => new CursorMaterials(), []);
  useEffect(() => () => materials.dispose(), [materials]);

  useFrame(() => {
    // Depth cue (F-3): dark disc where the pinch point projects onto the surface below, plus a thin drop line
    const marker = dropRef.current;
    const pinchAbove = handPhysics.pinchPoint;
    const drop = handPhysics.dropPoint;
    if (marker) {
      marker.visible = pinchAbove !== null && drop !== null;
      if (pinchAbove && drop) {
        marker.position.set(drop.x, drop.y + 0.02, drop.z);
        const height = pinchAbove.y - drop.y;
        if (dropLineRef.current) {
          dropLineRef.current.visible = height > 0.3;
          dropLineRef.current.scale.set(1, Math.max(height, 0.001), 1);
          dropLineRef.current.position.set(0, height / 2, 0);
        }
      }
    }

    const group = groupRef.current;
    if (!group) return;
    const pinch = handPhysics.pinchPoint;
    group.visible = pinch !== null;
    if (!pinch) return;
    group.position.set(pinch.x, pinch.y, pinch.z);
    // Make the cursor face the camera
    group.lookAt(camera.position);

    const look = cursorLook(handRef.current?.gesture ?? null, handPhysics.feedback.candidate !== null, useGameStore.getState().isCameraMode);
    materials.apply(look);
    // Ring grows as the pinch point nears a block
    const ringScale = 1 + handPhysics.feedback.proximity * 0.3;
    ringRef.current?.scale.set(ringScale, ringScale, 1);
    dotRef.current?.scale.set(look.dotScale, look.dotScale, 1);
    if (inRangeRef.current) inRangeRef.current.visible = look.inRange;
    if (sphereRef.current) sphereRef.current.visible = look.grabSphere;
    if (missedRef.current) missedRef.current.visible = handPhysics.pinchMissed;
    const hold = holdRef.current;
    if (hold) {
      hold.visible = clutch.progress > 0;
      hold.scale.setScalar(Math.max(clutch.progress, 0.001));
    }
  });

  return (
    <>
    {/* Depth cue: where the pinch point is above the surface below it */}
    <group ref={dropRef} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.25, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.45} depthWrite={false} />
      </mesh>
      <mesh ref={dropLineRef} material={materials.dropLine}>
        <cylinderGeometry args={[0.012, 0.012, 1, 6]} />
      </mesh>
    </group>

    <group ref={groupRef} position={[0, -100, 0]} visible={false}>
      {/* Outer ring - pulses with proximity */}
      <mesh ref={ringRef} material={materials.ring}>
        <ringGeometry args={[0.35, 0.4, 32]} />
      </mesh>

      {/* Secondary ring - shows when in grab range */}
      <mesh ref={inRangeRef} scale={[1.3, 1.3, 1]} visible={false} material={materials.inRange}>
        <ringGeometry args={[0.45, 0.48, 32]} />
      </mesh>

      {/* Inner dot - pinch indicator, grows with confidence */}
      <mesh ref={dotRef} material={materials.dot}>
        <circleGeometry args={[0.08, 16]} />
      </mesh>

      {/* Crosshair lines */}
      <mesh material={materials.cross}>
        <planeGeometry args={[0.02, 0.6]} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} material={materials.cross}>
        <planeGeometry args={[0.02, 0.6]} />
      </mesh>

      {/* Missed pinch - closed on nothing, won't grab until the hand reopens */}
      <mesh ref={missedRef} visible={false} scale={[1.3, 1.3, 1]}>
        <ringGeometry args={[0.45, 0.5, 32]} />
        <meshBasicMaterial color={CURSOR_COLORS.missed} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>

      {/* Camera-mode hold - fills the ring while an open palm is held still (H-2) */}
      <mesh ref={holdRef} visible={false}>
        <circleGeometry args={[0.35, 32]} />
        <meshBasicMaterial color={CURSOR_COLORS.camera} transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Grab sphere - shows when pinching and in range */}
      <mesh ref={sphereRef} visible={false} material={materials.sphere}>
        <sphereGeometry args={[GRAB_RADIUS, 16, 16]} />
      </mesh>
    </group>
    </>
  );
};
