const WORLD_WIDTH = 45;
const WORLD_HEIGHT = 22;
const Y_OFFSET = 8.5;
const SENSITIVITY = 1.1;

export function normalizeCoordinates(x: number, y: number) {
  // Center is 0.5. We expand from center to increase reach at webcam edges.
  const nx = (x - 0.5) * SENSITIVITY + 0.5;
  const ny = (y - 0.5) * SENSITIVITY + 0.5;

  const worldX = (0.5 - nx) * WORLD_WIDTH;
  
  // Apply Y offset to account for camera tilt (looking down at tower)
  const worldY = (0.5 - ny) * WORLD_HEIGHT + Y_OFFSET;

  return { x: worldX, y: worldY };
}