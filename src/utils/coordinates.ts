const WORLD_WIDTH = 30;
const WORLD_HEIGHT = 20;

export function normalizeCoordinates(x: number, y: number) {
  // Mirror X: (0.5 - x) * width
  const worldX = (0.5 - x) * WORLD_WIDTH;
  
  // Invert Y: (0.5 - y) * height
  const worldY = (0.5 - y) * WORLD_HEIGHT;

  return { x: worldX, y: worldY };
}
