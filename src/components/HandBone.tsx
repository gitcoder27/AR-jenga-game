import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { type RapierRigidBody } from '@react-three/rapier';

interface HandBoneProps {
  refs: React.MutableRefObject<(RapierRigidBody | null)[]>;
  startIdx: number;
  endIdx: number;
  /** Shared with the other bones; Hand recolours it with the gesture */
  material?: THREE.Material;
}

// Scratch vectors, shared by every bone: no allocations per frame (M-2)
const start = new THREE.Vector3();
const end = new THREE.Vector3();
const direction = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export const HandBone: React.FC<HandBoneProps> = ({ refs, startIdx, endIdx, material }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;

    const startBody = refs.current[startIdx];
    const endBody = refs.current[endIdx];

    if (!startBody || !endBody) return;

    start.copy(startBody.translation());
    end.copy(endBody.translation());

    // Height of the cylinder
    const distance = start.distanceTo(end);
    if (distance === 0) return;

    // Centred between the joints, pointing from start to end, as long as the gap
    meshRef.current.position.addVectors(start, end).multiplyScalar(0.5);
    direction.subVectors(end, start).normalize();
    meshRef.current.quaternion.setFromUnitVectors(UP, direction);
    meshRef.current.scale.set(1, distance, 1);
  });

  return (
    <mesh ref={meshRef} castShadow material={material}>
      <cylinderGeometry args={[0.04, 0.04, 1, 8]} />
    </mesh>
  );
};
