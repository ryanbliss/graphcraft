import type { Building } from "./layout.ts";

export const minimumStairDepth = 36;

export function stairwells(building: Building) {
  if (building.stories < 2) return [];
  const x = building.x + building.width / 2 - 2.5;
  return [-1, 1].map((side) => {
    const entryZ = building.z + side * (building.depth / 2 - 6);
    const exitZ = entryZ - side * 9;
    return {
      x,
      entryZ,
      exitZ,
      rear: Math.min(entryZ, exitZ),
      front: Math.max(entryZ, exitZ),
      direction: -side,
    };
  });
}
