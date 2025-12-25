import { useMemo } from 'react';
import { calculateDistance, type Point3D } from '../utils/math';

const PINCH_THRESHOLD = 0.05;

export default function useGesture(landmarks: Point3D[] | undefined) {
  const isPinching = useMemo(() => {
    if (!landmarks || landmarks.length < 9) return false;

    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    const distance = calculateDistance(thumbTip, indexTip);
    
    return distance < PINCH_THRESHOLD;
  }, [landmarks]);

  return { isPinching };
}