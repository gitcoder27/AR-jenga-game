import { useMemo } from 'react';
import { calculateDistance, type Point3D } from '../utils/math';

const PINCH_THRESHOLD = 0.05;
const CLOSED_FIST_THRESHOLD = 0.25;

export default function useGesture(landmarks: Point3D[] | undefined) {
  const isPinching = useMemo(() => {
    if (!landmarks || landmarks.length < 9) return false;

    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    const distance = calculateDistance(thumbTip, indexTip);

    return distance < PINCH_THRESHOLD;
  }, [landmarks]);

  const isClosedFist = useMemo(() => {
    if (!landmarks || landmarks.length < 21) return false;

    // Wrist is index 0
    const wrist = landmarks[0];

    // Fingertips: index(8), middle(12), ring(16), pinky(20)
    // We check if these 4 fingers are curled (close to wrist)
    const fingertipIndices = [8, 12, 16, 20];

    const isCurled = fingertipIndices.every(index => {
      const tip = landmarks[index];
      const distance = calculateDistance(wrist, tip);
      return distance < CLOSED_FIST_THRESHOLD;
    });

    return isCurled;
  }, [landmarks]);

  return { isPinching, isClosedFist };
}