export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export function calculateDistance(p1: Point3D, p2: Point3D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}