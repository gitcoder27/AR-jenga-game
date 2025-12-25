import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { type RapierRigidBody } from '@react-three/rapier';

interface HandBoneProps {
  refs: React.MutableRefObject<(RapierRigidBody | null)[]>;
  startIdx: number;
  endIdx: number;
  color?: string;
}

export const HandBone: React.FC<HandBoneProps> = ({ refs, startIdx, endIdx, color = "#888" }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    
    const startBody = refs.current[startIdx];
    const endBody = refs.current[endIdx];
    
    if (!startBody || !endBody) return;

    const startPos = startBody.translation();
    const endPos = endBody.translation();
    
    const startV = new THREE.Vector3(startPos.x, startPos.y, startPos.z);
    const endV = new THREE.Vector3(endPos.x, endPos.y, endPos.z);

    // Calculate center
    const center = new THREE.Vector3().addVectors(startV, endV).multiplyScalar(0.5);
    
    // Calculate distance (height of cylinder)
    const distance = startV.distanceTo(endV);
    if (distance === 0) return;
    
    // Position
    meshRef.current.position.copy(center);
    
    // Orientation: Look at the end point
    const direction = new THREE.Vector3().subVectors(endV, startV).normalize();
    meshRef.current.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), 
      direction
    );
    
    // Scale: Height matches distance
    meshRef.current.scale.set(1, distance, 1);
  });

  return (
    <mesh ref={meshRef}>
      <cylinderGeometry args={[0.04, 0.04, 1, 8]} />
      <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
    </mesh>
  );
};